"use client"

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'

import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList } from '@/components/ui/navigation-menu'
import styles from './styles.module.css'

const navItems = [
  { name: 'Home', path: '/' },
  { name: 'About', path: '/about' },
  { name: 'Projects', path: '/projects' },
  { name: 'Contact', path: '/contact' },
]

export default function Header() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  return (
    <header className="sticky top-0 z-50 w-full shadow-sm bg-[hsl(var(--header-bg))]">
      <div className="container relative flex h-16 items-center justify-between">
        <Link href="/" className={styles.logo}>
          Qijin Xu
        </Link>
        
        {/* Desktop Navigation - Centered */}
        <NavigationMenu className="absolute left-1/2 hidden -translate-x-1/2 transform md:block">
          <NavigationMenuList className="flex gap-6">
            {navItems.map((item) => (
              <NavigationMenuItem key={item.path} className="text-sm font-medium transition-colors">
                <Link 
                  href={item.path}
                  legacyBehavior
                  passHref
                >
                  <NavigationMenuLink
                    className={`px-4 py-2 rounded-md transition-colors duration-200
                      bg-[hsl(var(--header-nav-bg))] hover:bg-[hsl(var(--header-nav-hover))]
                      ${pathname === item.path ? 'text-primary dark:text-[hsl(210,40%,90%)] bg-[hsl(var(--header-nav-hover))]' : 'text-foreground dark:text-[hsl(210,40%,90%)]'}`}
                  >
                    {item.name}
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>
        
        <div className="flex items-center gap-4">
          <ThemeToggle />
          
          <Button 
            variant="default" 
            size="sm"
            className="bg-primary hover:bg-primary/90"
            asChild
          >
            <a 
              href="/QijinXu_Resume.pdf" 
              download="QijinXu_Resume.pdf"
              target="_blank"
              rel="noopener noreferrer"
            >
              Download Resume
            </a>
          </Button>
          
          {/* Mobile Menu Toggle */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden hover:bg-primary/10" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>
      
      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="container md:hidden">
          <nav className="flex flex-col space-y-4 py-4">
            {navItems.map((item) => (
              <Link 
                key={item.path} 
                href={item.path}
                className={`px-4 py-3 rounded-md transition-colors duration-200
                  bg-[hsl(var(--header-nav-bg))] hover:bg-[hsl(var(--header-nav-hover))]
                  ${pathname === item.path ? 'text-primary dark:text-[hsl(210,40%,90%)] bg-[hsl(var(--header-nav-hover))]' : 'text-foreground dark:text-[hsl(210,40%,90%)]'}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  )
} 