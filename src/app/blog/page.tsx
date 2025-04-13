import { promises as fs } from 'fs'
import path from 'path'
import matter from 'gray-matter'
import Link from 'next/link'
import PageHeader from '@/components/page-header'
import styles from '@/styles/pages/about.module.css'
import blogStyles from '@/styles/pages/blog.module.css'
import { blogContent } from '@/content/pages/blog'

async function getBlogPosts() {
  const blogDirectory = path.join(process.cwd(), 'src/content/blog')
  const blogFolders = await fs.readdir(blogDirectory)
  
  const posts = await Promise.all(
    blogFolders.map(async (folder) => {
      const filePath = path.join(blogDirectory, folder, 'index.mdx')
      const fileContents = await fs.readFile(filePath, 'utf8')
      const { data } = matter(fileContents)
      
      return {
        slug: folder,
        title: data.title,
        date: data.date,
        description: data.description,
      }
    })
  )
  
  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export default async function BlogPage() {
  const posts = await getBlogPosts()
  const { header, sections } = blogContent
  
  return (
    <div className={styles.pageContainer}>
      <PageHeader 
        title={header.title} 
        subtitle={header.subtitle}
        description={header.description}
      />
      
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{sections.recentPosts.title}</h2>
        <div className="space-y-8 mt-6">
          {posts.map((post) => (
            <article key={post.slug} className={blogStyles.blogCard}>
              <Link 
                href={`/blog/${post.slug}`} 
                className="block"
              >
                <div className="space-y-4">
                  <h3 className={blogStyles.blogTitle}>
                    {post.title}
                  </h3>
                  <div className="flex items-center justify-between">
                    <time 
                      dateTime={post.date}
                      className={blogStyles.blogDate}
                    >
                      {new Date(post.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </time>
                  </div>
                  <p className={blogStyles.blogDescription}>
                    {post.description}
                  </p>
                  <div className={blogStyles.readMore}>
                    Read more
                    <svg 
                      className="ml-2 w-4 h-4" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M9 5l7 7-7 7" 
                      />
                    </svg>
                  </div>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
} 