"use client"

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList } from '@/components/ui/navigation-menu'

const navItems = [
  { name: 'Home', path: '/' },
  { name: 'About', path: '/about' },
  { name: 'Projects', path: '/projects' },
  { name: 'Blog', path: '/blog' },
  { name: 'Contact', path: '/contact' },
]

export default function Header() {
  const pathname = usePathname()
  
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link 
          href="/" 
          className="flex items-center gap-2 text-2xl font-bold tracking-tight"
        >
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Portfolio
          </span>
        </Link>
        
        <NavigationMenu>
          <NavigationMenuList className="hidden md:flex md:gap-6">
            {navItems.map((item) => (
              <NavigationMenuItem key={item.path}>
                <Link 
                  href={item.path}
                  legacyBehavior
                  passHref
                >
                  <NavigationMenuLink
                    className={`text-sm font-medium ${pathname === item.path ? 'text-primary' : 'text-muted-foreground'} transition-colors hover:text-primary`}
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
          <Button className="hidden md:flex" asChild>
            <Link href="/contact">Hire Me</Link>
          </Button>
        </div>
      </div>
    </header>
  )
} 