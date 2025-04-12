import { promises as fs } from 'fs'
import path from 'path'
import { MDXRemote } from 'next-mdx-remote/rsc'
import matter from 'gray-matter'
import Image from 'next/image'
import styles from '@/styles/pages/about.module.css'
import blogStyles from '@/styles/pages/blog.module.css'

async function getBlogPost(slug: string) {
  const filePath = path.join(process.cwd(), 'src/content/blog', slug, 'index.mdx')
  const fileContents = await fs.readFile(filePath, 'utf8')
  const { data, content } = matter(fileContents)
  
  // Copy images to public directory if they don't exist
  const blogDir = path.join(process.cwd(), 'src/content/blog', slug)
  const publicDir = path.join(process.cwd(), 'public/blog', slug)
  
  try {
    await fs.mkdir(publicDir, { recursive: true })
    const files = await fs.readdir(blogDir)
    
    for (const file of files) {
      if (file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png')) {
        const sourcePath = path.join(blogDir, file)
        const destPath = path.join(publicDir, file)
        try {
          await fs.copyFile(sourcePath, destPath)
        } catch (err) {
          // File might already exist, which is fine
        }
      }
    }
  } catch (err) {
    console.error('Error copying images:', err)
  }
  
  return {
    title: data.title,
    date: data.date,
    description: data.description,
    content,
    slug,
  }
}

export default async function BlogPost({ params }: { params: { slug: string } }) {
  const post = await getBlogPost(params.slug)
  
  return (
    <div className={styles.pageContainer}>
      {/* Header Section */}
      <section className={styles.headerSection}>
        <h1 className={styles.headerTitle}>{post.title}</h1>
        <h2 className={styles.headerSubtitle}>
          {new Date(post.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
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