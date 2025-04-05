import React from 'react'

export default function AboutPage() {
  return (
    <div className="container py-12">
      <h1 className="mb-8 text-4xl font-bold tracking-tight">About Me</h1>
      
      <div className="prose dark:prose-invert lg:prose-lg">
        <p>
          As a passionate Software Development Engineer with expertise in machine learning and AI technologies, 
          I build intelligent systems that derive insights from data and solve complex problems.
        </p>
        
        <h2>My Journey</h2>
        <p>
          I've been coding and working with data throughout my academic and professional career,
          expanding my expertise to include a wide array of technologies in the machine learning and software development space.
        </p>
        
        <h2>Professional Experience</h2>
        <ul>
          <li>
            <strong>Amazon</strong> - Software Development Engineer Intern (2023)
            <p>Worked on machine learning and recommendation systems for large-scale applications</p>
          </li>
          <li>
            <strong>StoneX</strong> - Research Assistant (2022-2023)
            <p>Implemented machine learning algorithms and conducted data analysis for financial applications</p>
          </li>
        </ul>
        
        <h2>Education</h2>
        <p>
          Master's in Information Technology and Analytics<br />
          Rutgers University, 2023
        </p>
        
        <h2>Skills</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <h3 className="text-lg font-semibold">Machine Learning</h3>
            <ul>
              <li>Deep Learning</li>
              <li>NLP</li>
              <li>Recommendation Systems</li>
              <li>ML Algorithms</li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold">Data</h3>
            <ul>
              <li>Data Analysis</li>
              <li>Data Pipelines</li>
              <li>SQL/NoSQL</li>
              <li>Big Data Processing</li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold">Tools & Technologies</h3>
            <ul>
              <li>Python</li>
              <li>TensorFlow/PyTorch</li>
              <li>Git/GitHub</li>
              <li>Cloud Platforms</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
} 