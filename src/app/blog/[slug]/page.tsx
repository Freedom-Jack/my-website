import { promises as fs } from 'fs'
import path from 'path'
import { MDXRemote } from 'next-mdx-remote/rsc'
import matter from 'gray-matter'
import Image from 'next/image'
import Link from 'next/link'
import styles from '@/styles/pages/about.module.css'
import blogStyles from '@/styles/pages/blog.module.css'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { blogPostContent } from '@/content/pages/blog-post'

async function getBlogPost(slug: string) {
  const filePath = path.join(process.cwd(), 'public/blog', slug, 'index.mdx')
  const fileContents = await fs.readFile(filePath, 'utf8')
  const { data, content } = matter(fileContents)
  
  return {
    title: data.title,
    date: data.date,
    description: data.description,
    content,
    slug,
  }
}

export default async function BlogPost(props0: { params: Promise<{ slug: string }> }) {
  const params = await props0.params;
  const post = await getBlogPost(params.slug)
  const { backButton, header } = blogPostContent

  return (
    <div className={styles.pageContainer}>
      {/* Back to Blog Button */}
      <div className="mb-6">
        <Link href="/blog" passHref>
          <Button variant="outline" size="sm" className="flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            {backButton.text}
          </Button>
        </Link>
      </div>
      
      {/* Header Section */}
      <section className={styles.headerSection}>
        <h1 className={styles.headerTitle}>{post.title}</h1>
        <h2 className={styles.headerSubtitle}>
          {new Date(post.date).toLocaleDateString('en-US', header.dateFormat)}
        </h2>
        <p className={styles.headerDescription}>{post.description}</p>
      </section>

      {/* Content */}
      <section className={styles.section}>
        <div className={blogStyles.blogContent}>
          <MDXRemote 
            source={post.content}
            components={{
              img: (props: any) => {
                const { src, alt, ...rest } = props;
                if (!src) return null;
                
                // Use the public path for images
                const imagePath = `/blog/${post.slug}/${src}`;
                
                return (
                  <span className="block my-8">
                    <Image
                      src={imagePath}
                      alt={alt || ''}
                      width={800}
                      height={600}
                      className="rounded-lg shadow-lg mx-auto"
                      {...rest}
                    />
                  </span>
                );
              }
            }}
          />
        </div>
      </section>
    </div>
  )
} 