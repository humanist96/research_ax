import * as crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  getProject,
  setProjectStatus,
  getProjectArticles,
  saveProjectArticles,
  getProjectCollectionLog,
  saveProjectCollectionLog,
} from '@/lib/project/store'
import { aggregateSearch } from '@/lib/collector/aggregator'
import { matchDynamicKeywords, isRelevant } from '@/lib/collector/keyword-matcher'
import type { Article, CollectionLog } from '@/types'

function generateId(url: string): string {
  return crypto.createHash('md5').update(url).digest('hex').slice(0, 12)
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const project = await getProject(id)
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      )
    }

    if (!project.config) {
      return NextResponse.json(
        { success: false, error: 'Project has no config' },
        { status: 400 }
      )
    }

    const config = project.config

    try {
      await setProjectStatus(id, 'collecting')

      const existingArticles = await getProjectArticles(id)
      const existingUrls = new Set(existingArticles.map((a) => a.url))
      const errors: string[] = []

      const searchResults = await aggregateSearch(config, {
        queries: config.searchQueries,
        enrichBodies: config.enrichArticles ?? false,
        maxResultsPerSource: config.maxArticlesPerSource ?? 20,
      })

      const allItems = searchResults.map((item) => ({
        title: item.title,
        url: item.link,
        content: item.content,
        publishedAt: item.pubDate,
        source: item.source,
      }))

      const newArticles: Article[] = []
      for (const item of allItems) {
        if (existingUrls.has(item.url)) continue

        const { matchedKeywords, relevanceScore } = matchDynamicKeywords(
          item.title,
          item.content,
          config
        )

        if (!isRelevant(relevanceScore, config.minRelevanceScore)) continue

        newArticles.push({
          id: generateId(item.url),
          title: item.title,
          url: item.url,
          source: item.source,
          publishedAt: new Date(item.publishedAt).toISOString(),
          content: item.content,
          matchedKeywords,
          relevanceScore,
          collectedAt: new Date().toISOString(),
        })

        existingUrls.add(item.url)
      }

      const allArticles = [...existingArticles, ...newArticles]
      await saveProjectArticles(id, allArticles as Article[])

      const log: CollectionLog = {
        timestamp: new Date().toISOString(),
        sourcesChecked: config.rssSources.length + config.searchQueries.length,
        articlesFound: allItems.length,
        articlesAdded: newArticles.length,
        errors,
      }

      const logs = [...await getProjectCollectionLog(id), log]
      await saveProjectCollectionLog(id, logs)

      await setProjectStatus(id, 'ready')
      const updated = await getProject(id)
      return NextResponse.json({ success: true, data: updated })
    } catch (error) {
      await setProjectStatus(id, 'error')
      throw error
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
