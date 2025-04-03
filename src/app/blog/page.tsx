import React from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

interface BlogPost {
  slug: string
  title: string
  description: string
  date: string
  readingTime: string
  category: string
}

const blogPosts: BlogPost[] = [
  {
    slug: 'building-modern-web-applications',
    title: 'Building Modern Web Applications with Next.js and TypeScript',
    description: 'Learn how to leverage Next.js 14 features and TypeScript to build high-performance web applications.',
    date: '2023-12-15',
    readingTime: '8 min read',
    category: 'Web Development'
  },
  {
    slug: 'optimizing-react-performance',
    title: 'Advanced Techniques for Optimizing React Performance',
    description: 'Explore strategies for optimizing React applications, from code splitting to memoization.',
    date: '2023-11-20',
    readingTime: '12 min read',
    category: 'React'
  },
  {
    slug: 'serverless-architecture',
    title: 'Introduction to Serverless Architecture',
    description: 'Understand the benefits and challenges of serverless architectures for modern web applications.',
    date: '2023-10-05',
    readingTime: '10 min read',
    category: 'Backend'
  },
  {
    slug: 'css-architecture',
    title: 'Building Scalable CSS Architecture with Tailwind',
    description: 'How to architect your CSS for large applications while maintaining consistency and performance.',
    date: '2023-09-18',
    readingTime: '7 min read',
    category: 'CSS'
  }
]

export default function BlogPage() {
  return (
    <div className="container py-12">
      <h1 className="mb-8 text-4xl font-bold tracking-tight">Blog</h1>
      
      <p className="mb-10 text-lg text-muted-foreground">
        Technical articles, tutorials, and thoughts on software development, 
        web technologies, and career growth.
      </p>
      
      <div className="space-y-8">
        {blogPosts.map((post) => (
          <article key={post.slug} className="group">
            <Link href={`/blog/${post.slug}`}>
              <div className="rounded-lg border bg-card p-6 transition-all hover:bg-accent/10">
                <div className="mb-2 flex items-center text-sm text-muted-foreground">
                  <span>{formatDate(post.date)}</span>
                  <span className="mx-2">•</span>
                  <span>{post.readingTime}</span>
                  <span className="mx-2">•</span>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                    {post.category}
                  </span>
                </div>
                
                <h2 className="mb-2 text-2xl font-bold group-hover:text-primary">
                  {post.title}
                </h2>
                
                <p className="text-muted-foreground">
                  {post.description}
                </p>
                
                <div className="mt-4 text-sm font-medium text-primary">
                  Read more →
                </div>
              </div>
            </Link>
          </article>
        ))}
      </div>
    </div>
  )
} 