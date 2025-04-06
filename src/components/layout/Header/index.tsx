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
    <header className={styles.header}>
      <div className={styles.headerContainer}>
        <Link href="/" className={styles.logo}>
          Qijin Xu
        </Link>
        
        {/* Desktop Navigation - Centered */}
        <NavigationMenu className={styles.navMenu}>
          <NavigationMenuList className={styles.navList}>
            {navItems.map((item) => (
              <NavigationMenuItem key={item.path} className={styles.navItem}>
                <Link 
                  href={item.path}
                  legacyBehavior
                  passHref
                >
                  <NavigationMenuLink
                    className={`${styles.navLink} ${pathname === item.path ? styles.navLinkActive : ''}`}
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
          
          {/* Mobile Menu Toggle */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>
      
      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className={styles.mobileMenu}>
          <nav className={styles.mobileNav}>
            {navItems.map((item) => (
              <Link 
                key={item.path} 
                href={item.path}
                className={`${styles.navLink} ${pathname === item.path ? styles.navLinkActive : ''}`}
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