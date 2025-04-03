import React from 'react'
import { Mail, Github, Linkedin } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ContactPage() {
  return (
    <div className="container py-12">
      <h1 className="mb-8 text-4xl font-bold tracking-tight">Contact Me</h1>
      
      <div className="grid gap-12 md:grid-cols-2">
        <div>
          <p className="mb-6 text-lg text-muted-foreground">
            I'm always open to discussing new projects, opportunities, or collaborations.
            Feel free to reach out through any of the channels below.
          </p>
          
          <div className="mb-8 space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-primary" />
              <a href="mailto:your.email@example.com" className="hover:underline">
                your.email@example.com
              </a>
            </div>
            
            <div className="flex items-center gap-3">
              <Github className="h-5 w-5 text-primary" />
              <a href="https://github.com/yourusername" target="_blank" rel="noopener noreferrer" className="hover:underline">
                github.com/yourusername
              </a>
            </div>
            
            <div className="flex items-center gap-3">
              <Linkedin className="h-5 w-5 text-primary" />
              <a href="https://linkedin.com/in/yourusername" target="_blank" rel="noopener noreferrer" className="hover:underline">
                linkedin.com/in/yourusername
              </a>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="gap-2" asChild>
              <a href="mailto:your.email@example.com">
                <Mail className="h-4 w-4" />
                Send Email
              </a>
            </Button>
            <Button variant="outline" className="gap-2" asChild>
              <a href="/resume.pdf" target="_blank" rel="noopener noreferrer">
                Download Resume
              </a>
            </Button>
          </div>
        </div>
        
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-2xl font-semibold">Send a Message</h2>
          <form className="space-y-4">
            <div>
              <label htmlFor="name" className="mb-2 block text-sm font-medium">
                Name
              </label>
              <input
                type="text"
                id="name"
                className="w-full rounded-md border bg-background px-4 py-2"
                placeholder="Your name"
              />
            </div>
            
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium">
                Email
              </label>
              <input
                type="email"
                id="email"
                className="w-full rounded-md border bg-background px-4 py-2"
                placeholder="your.email@example.com"
              />
            </div>
            
            <div>
              <label htmlFor="message" className="mb-2 block text-sm font-medium">
                Message
              </label>
              <textarea
                id="message"
                rows={5}
                className="w-full rounded-md border bg-background px-4 py-2"
                placeholder="Your message..."
              ></textarea>
            </div>
            
            <Button type="submit">Send Message</Button>
          </form>
        </div>
      </div>
    </div>
  )
} 