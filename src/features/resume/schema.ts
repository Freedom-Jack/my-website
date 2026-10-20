import { z } from 'zod';

/**
 * content/resume.json: JSON Resume (v1.0.0) as the single source of the web résumé (/resume/), its PDF
 * (/resume.pdf), the machine-readable copy (/resume.json) and the Person JSON-LD.
 *
 * Strict on purpose: an unknown key fails the build, so a phone number or a street address can never slip in
 * through the schema's optional fields (DESIGN §2: no phone anywhere, the city only). The few extensions the
 * page needs (marked "page only") are dropped from the public /resume.json.
 * Strings may use the inline markup of CONTENT.md ([link](url), **bold**, {{years+}}).
 */

const isoMonth = z.string().regex(/^\d{4}(-\d{2})?(-\d{2})?$/, 'an ISO date: 2025, 2025-01 or 2025-01-31');

const profile = z.object({ network: z.string(), username: z.string(), url: z.url() }).strict();

const basics = z
  .object({
    name: z.string().min(1),
    label: z.string().min(1),
    email: z.email(),
    summary: z.string().min(1),
    location: z.object({ city: z.string(), region: z.string(), countryCode: z.string().length(2) }).strict(),
    profiles: z.array(profile),
  })
  .strict();

const work = z
  .object({
    name: z.string(),
    location: z.string().optional(),
    url: z.url().optional(),
    position: z.string(),
    startDate: isoMonth,
    endDate: isoMonth.optional(),
    highlights: z.array(z.string()).min(1),
  })
  .strict();

const education = z
  .object({
    institution: z.string(),
    url: z.url().optional(),
    area: z.string(),
    studyType: z.string(),
    startDate: isoMonth,
    endDate: isoMonth,
    score: z.string().optional(),
    /** page only: "Toronto, ON" */
    location: z.string().optional(),
    /** page only: the degree as the page writes it ("B.Sc. Computer Science, Specialized Honours") */
    degree: z.string(),
    /** page only: honours beside the score ("Dean’s List") */
    honors: z.array(z.string()).optional(),
  })
  .strict();

const award = z
  .object({
    title: z.string(),
    date: isoMonth,
    awarder: z.string(),
    summary: z.string().optional(),
    /** page only: the line after the year ("for the enterprise RAG assistant"); never for the 2026 award */
    note: z.string().optional(),
  })
  .strict();

const certificate = z
  .object({
    name: z.string(),
    date: isoMonth,
    issuer: z.string(),
    url: z.url().optional(),
    /** page only (the JSON-LD's recognizedBy) */
    issuerUrl: z.url().optional(),
  })
  .strict();

const skill = z.object({ name: z.string(), keywords: z.array(z.string()).min(1) }).strict();

export const resumeSchema = z
  .object({
    $schema: z.string().optional(),
    basics,
    work: z.array(work).min(1),
    education: z.array(education),
    awards: z.array(award),
    certificates: z.array(certificate),
    skills: z.array(skill),
    meta: z.object({ version: z.string(), lastModified: isoMonth }).strict(),
  })
  .strict();

export type Resume = z.infer<typeof resumeSchema>;
export type WorkEntry = Resume['work'][number];
