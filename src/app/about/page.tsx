import React from 'react'

export default function AboutPage() {
  return (
    <div className="container py-12">
      <h1 className="mb-8 text-4xl font-bold tracking-tight">About Me</h1>
      
      <div className="prose dark:prose-invert lg:prose-lg">
        <p>
          As a passionate full-stack developer with expertise in modern web technologies, 
          I build scalable, performant applications with exceptional user experiences.
        </p>
        
        <h2>My Journey</h2>
        <p>
          I've been coding since [year], starting with [language/framework]. Over the years, 
          I've expanded my expertise to include a wide array of technologies and methodologies.
        </p>
        
        <h2>Professional Experience</h2>
        <ul>
          <li>
            <strong>Company Name</strong> - Senior Developer (2020-Present)
            <p>Led development of scalable web applications using React, TypeScript and Node.js</p>
          </li>
          <li>
            <strong>Previous Company</strong> - Full-Stack Developer (2018-2020)
            <p>Designed and implemented RESTful APIs and frontend interfaces</p>
          </li>
        </ul>
        
        <h2>Education</h2>
        <p>
          Bachelor of Science in Computer Science<br />
          University Name, Graduation Year
        </p>
        
        <h2>Skills</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <h3 className="text-lg font-semibold">Frontend</h3>
            <ul>
              <li>React</li>
              <li>TypeScript</li>
              <li>Next.js</li>
              <li>Tailwind CSS</li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold">Backend</h3>
            <ul>
              <li>Node.js</li>
              <li>Express</li>
              <li>GraphQL</li>
              <li>SQL/NoSQL</li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold">Tools & Methods</h3>
            <ul>
              <li>Git/GitHub</li>
              <li>CI/CD</li>
              <li>Agile/Scrum</li>
              <li>TDD</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
} 