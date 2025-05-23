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
import AboutSection from '@/components/sections/About'
import { homeContent } from '@/content/pages/home'
import { Metadata } from 'next'
import MobileTableOfContents from './MobileTableOfContents'
import TableOfContents from './TableOfContents'

// Function to extract headings from markdown content
function extractHeadings(content: string) {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const headings = [];
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    
    // Skip h1 headings (title) for the table of contents
    if (level === 1) continue;
    
    const slug = text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-');
    
    headings.push({
      level,
      text,
      slug,
    });
  }

  return headings;
}

async function getBlogPost(slug: string) {
  const filePath = path.join(process.cwd(), 'public/blog', slug, 'index.mdx')
  const fileContents = await fs.readFile(filePath, 'utf8')
  const { data, content } = matter(fileContents)
  
  return {
    title: data.title,
    date: data.date,
    description: data.description,
    keywords: data.keywords || '',
    author: data.author || '',
    image: data.image || '',
    content,
    slug,
  }
}

// Generate metadata for better SEO
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const awaitedParams = await params
  const post = await getBlogPost(awaitedParams.slug)
  const imagePath = post.image ? `/blog/${post.slug}/${post.image}` : null

  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    authors: post.author ? [{ name: post.author }] : [],
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      url: `/blog/${post.slug}`,
      images: imagePath ? [{ url: imagePath }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: imagePath ? [imagePath] : [],
    },
  }
}

// Fix type issue with Next.js 15.3.0 page props
type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function BlogPost({ params }: Props) {
  const awaitedParams = await params
  const post = await getBlogPost(awaitedParams.slug)
  const { backButton, header, authorSection, jsonLd } = blogPostContent
  
  // Extract headings from the content for the table of contents
  const headings = extractHeadings(post.content)

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
          {new Date(post.date + 'T00:00:00').toLocaleDateString('en-US', header.dateFormat)}
        </h2>
        <p className={styles.headerDescription}>{post.description}</p>
      </section>

      {/* Mobile Table of Contents */}
      <MobileTableOfContents headings={headings} />

      {/* Content */}
      <section className={styles.section}>
        {/* Desktop Table of Contents - show on medium screens and up */}
        <div className="hidden md:block mb-8 max-w-2xl mx-auto">
          <TableOfContents headings={headings} />
        </div>

        {/* Article Content */}
        <div className={blogStyles.blogContent}>
          {/* Add JSON-LD structured data for SEO */}
          <script
            type={jsonLd.schema}
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': jsonLd.context,
                '@type': jsonLd.type,
                'headline': post.title,
                'datePublished': post.date,
                'dateModified': post.date,
                'description': post.description,
                'author': {
                  '@type': jsonLd.personType,
                  'name': post.author || '',
                },
                'image': post.image ? `/blog/${post.slug}/${post.image}` : '',
                'mainEntityOfPage': {
                  '@type': jsonLd.webPageType,
                  '@id': `${process.env.NEXT_PUBLIC_SITE_URL || ''}/blog/${post.slug}`,
                },
              })
            }}
          />
          
          <MDXRemote 
            source={post.content}
            components={{
              img: (props: any) => {
                const { src, alt, ...rest } = props;
                if (!src) return null;
                
                // Use the public path for images - normalize the path to avoid case sensitivity issues
                const normalizedSrc = src.replace(/^\.\//, ''); // Remove leading ./ if present
                const imagePath = `/blog/${post.slug}/${normalizedSrc}`;
                
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
              },
              h1: ({ children }: { children: React.ReactNode }) => {
                const text = children?.toString() || '';
                const slug = text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-');
                return <h1 id={slug}>{children}</h1>;
              },
              h2: ({ children }: { children: React.ReactNode }) => {
                const text = children?.toString() || '';
                const slug = text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-');
                return <h2 id={slug}>{children}</h2>;
              },
              h3: ({ children }: { children: React.ReactNode }) => {
                const text = children?.toString() || '';
                const slug = text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-');
                return <h3 id={slug}>{children}</h3>;
              },
              h4: ({ children }: { children: React.ReactNode }) => {
                const text = children?.toString() || '';
                const slug = text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-');
                return <h4 id={slug}>{children}</h4>;
              },
              h5: ({ children }: { children: React.ReactNode }) => {
                const text = children?.toString() || '';
                const slug = text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-');
                return <h5 id={slug}>{children}</h5>;
              },
              h6: ({ children }: { children: React.ReactNode }) => {
                const text = children?.toString() || '';
                const slug = text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-');
                return <h6 id={slug}>{children}</h6>;
              }
            }}
          />
        </div>
      </section>

      {/* About the Author Section */}
      <div className="mt-16 pt-8 border-t">
        <h2 className="text-2xl font-bold mb-8 text-center">{authorSection.title}</h2>
        <AboutSection content={homeContent.about} />
      </div>
    </div>
  )
} 