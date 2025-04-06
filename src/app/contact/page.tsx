import React from 'react'
import { Mail, Github, Linkedin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { contactInfo } from '@/content/contact-info'
import { contactContent } from '@/content/pages/contact'

export default function ContactPage() {
  return (
    <div className="container py-12">
      <h1 className="mb-8 text-4xl font-bold tracking-tight">{contactContent.header.title}</h1>
      
      <div className="max-w-xl">
        <p className="mb-6 text-lg text-muted-foreground">
          {contactContent.header.description}
        </p>
        
        <div className="mb-8 space-y-4">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-primary" />
            <a href={`mailto:${contactInfo.email.address}`} className="hover:underline">
              {contactInfo.email.display}
            </a>
          </div>
          
          <div className="flex items-center gap-3">
            <Github className="h-5 w-5 text-primary" />
            <a href={contactInfo.github.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
              GitHub.com/{contactInfo.github.username}
            </a>
          </div>
          
          <div className="flex items-center gap-3">
            <Linkedin className="h-5 w-5 text-primary" />
            <a href={contactInfo.linkedin.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {contactInfo.linkedin.profile}
            </a>
          </div>
        </div>
        
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="gap-2" asChild>
            <a href={`mailto:${contactInfo.email.address}`}>
              <Mail className="h-4 w-4" />
              {contactContent.buttons.email}
            </a>
          </Button>
          <Button variant="outline" className="gap-2" asChild>
            <a href="/QijinXu_Resume.pdf" target="_blank" rel="noopener noreferrer">
              {contactContent.buttons.resume}
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
} 