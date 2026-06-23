# Goonj: AI-Powered Welfare Scheme Discovery Portal

Goonj is a modern, accessible, and intelligent web application designed to help citizens of India discover, understand, and apply for government welfare schemes. By leveraging Clerk authentication, relational PostgreSQL database storage, and Google Gemini AI, Goonj simplifies the process of finding relevant social benefits through conversational AI, speech accessibility, and semantic matchmaking.

---

## 🛠️ Technology Stack

- **Core Framework**: Next.js 16.2.9 (Turbopack, App Router)
- **Runtime & View Library**: React 19.2.4 & React DOM
- **Authentication**: Clerk Authentication (`@clerk/nextjs`)
- **Database ORM**: Prisma Client (`@prisma/client` v5.22.0)
- **Database Provider**: PostgreSQL (Supabase)
- **AI Engine**: Google Gemini API (`@google/genai`) for embeddings, semantic matching, and voice profiling
- **Styling**: Vanilla CSS with Tailwind CSS v4 integration
- **Utilities**: Lucide Icons, Axios, PDF-Parse, and HTML-to-Text

---

## 📂 Project Structure

```
d:\day3\app
├── prisma
│   ├── dev.db                      # Local SQLite backup (deprecated in production)
│   ├── schema.prisma               # Prisma DB schema definitions (PostgreSQL provider)
│   └── seed.js                     # Seed script for initial schemes & Gemini vectors
├── public                          # Public assets & static media
├── src
│   ├── app
│   │   ├── admin
│   │   │   └── page.tsx            # Secure Admin Dashboard UI
│   │   ├── api
│   │   │   ├── admin
│   │   │   │   ├── analytics       # Admin analytics route (saved schemes count, search volume, etc.)
│   │   │   │   ├── purge           # DB purge API route
│   │   │   │   ├── schemes         # Scheme CRUD API route (admin protected)
│   │   │   │   └── verify-secret   # Secret key verify route to elevate to Admin metadata
│   │   │   ├── auth
│   │   │   │   ├── login           # Legacy login endpoint (force-dynamic)
│   │   │   │   ├── logout          # Legacy logout endpoint (force-dynamic)
│   │   │   │   └── session         # Session lookup API route
│   │   │   ├── chat                # Main search matching and conversational chat API route
│   │   │   ├── match               # Scheme matching engine logic
│   │   │   └── user
│   │   │       ├── feedback        # Scheme feedback API route
│   │   │       ├── reports         # Downloaded report log API route
│   │   │       ├── saved-schemes   # Saved bookmark schemes API route
│   │   │       └── search-history  # Fetch search history logs route
│   │   ├── print
│   │   │   └── page.tsx            # Printable scheme summary report view
│   │   ├── favicon.ico
│   │   ├── globals.css             # Main stylesheet configuring design system tokens
│   │   ├── layout.tsx              # Root layout wrapped in ClerkProvider
│   │   └── page.tsx                # Main conversational discovering page for citizens
│   ├── lib
│   │   ├── adminAuth.ts            # Clerk admin metadata role checks
│   │   ├── auth.ts                 # Clerk DB synchronization & legacy phone data migrator
│   │   ├── db.ts                   # Singleton Prisma client instance
│   │   ├── gemini.ts               # Vector embedding generation & LLM profiling wrappers
│   │   ├── parser.ts               # Documents parser utility
│   │   └── vectorStore.ts          # Local Cosine Similarity vector store functions
│   └── middleware.ts               # Clerk Auth interceptor middleware
├── .env                            # Application environment credentials
├── next.config.ts                  # Next.js configurations
├── package.json                    # Dependencies & build scripts
├── tsconfig.json                   # TypeScript configurations
└── test-db.js                      # DB connection testing utility
```

---

## ✨ Features

### 1. Unified Authentication & Identity Management
- Integrates **Clerk Auth** for seamless social or email/phone sign-in.
- Synchronizes Clerk authentication with the PostgreSQL database.
- Implements transaction-safe **Account Migration**: Legacy bookmarks, reports, and search histories are migrated based on the Clerk user's verified phone number on first login.

### 2. Interactive AI Discovering & Semantic Search
- **Voice Interview Flow**: Conversational prompts gather demographic details (State, Age, Gender, Income, Caste, Occupation, Disability status).
- **LLM Demographics Parsing**: Gemini parses unstructured user speech into clean structured JSON profiles.
- **Semantic Vector Matching**: User profile and needs are converted into vector embeddings using `gemini-embedding-2` and matched against scheme guidelines in the database via cosine similarity.

### 3. Scheme Browsing & Accessibility
- Detailed rendering of scheme titles, ministries, rules, and application steps.
- **Audio Synthesizer**: Text-to-Speech (TTS) engine reads scheme descriptions aloud to enhance accessibility.
- **Direct Application URLs**: Links to official application portals, with dynamic Google Search fallback URLs based on the scheme name.
- **Save/Bookmark System**: Save schemes to your profile for quick review.

### 4. Report Print & Download
- Print-friendly dashboard generating formatted summaries of matching schemes.
- Logs report downloads to user analytics records.

### 5. Secure Admin Dashboard
- **Admin Secret Verification**: Promotion to the admin role via an `ADMIN_SECRET_KEY` check, updating public Clerk metadata dynamically.
- **Analytics & History**: Track search history, popular schemes, and user demographics.
- **Database Control**: Dynamic CRUD management for schemes and full database purges.

---

## 🗄️ Database Schema

The database uses the following relational Prisma schema in PostgreSQL:

- **`Scheme`**: Holds details about welfare schemes (eligibility rules, guidelines, ministry, links, and application steps).
- **`SchemeVector`**: Holds broken-down text chunks of scheme guidelines with their high-dimensional vector embeddings.
- **`User`**: Maps authenticated Clerk users to local DB profiles.
- **`SavedScheme`**: Relational join table tracking bookmarks/favorites.
- **`SearchHistory`**: Logs search inputs, detected languages, and demographic profiles to build metrics.
- **`DownloadedReport`**: Tracks which reports were printed/downloaded.
- **`Feedback`**: Tracks scheme helpfulness rating logs.

---

## 🚀 Setup & Installation

### 1. Prerequisites
- **Node.js** (v18+)
- **NPM** or **Yarn**
- A **Supabase** or alternative PostgreSQL instance
- A **Gemini API Key**
- A **Clerk App Instance**

### 2. Environment Configuration
Create a `.env` file in the root directory:
```env
# Database Credentials
DATABASE_URL="postgresql://<username>:<password>@<host>:<port>/postgres?sslmode=require"
DIRECT_URL="postgresql://<username>:<password>@<host>:<port>/postgres?sslmode=require"

# Gemini AI Credentials
GEMINI_API_KEY="AIzaSy..."

# Clerk Auth Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Admin Secrets
ADMIN_SECRET_KEY="GoonjAdminSecr3tK3y2026"
```

### 3. Setup Commands
```bash
# Install Dependencies
npm install

# Push Prisma Database Schema
npx prisma db push

# Seed Initial Welfare Schemes & Gemini Vector Embeddings
node prisma/seed.js

# Run Development Server
npm run dev
```

### 4. Build Commands
```bash
# Test local database query
node test-db.js

# Build production bundle
npm run build
```
*(The build script is configured with `prisma generate && next build` to guarantee compilation succeeds on Vercel platforms, bypassing caching issues).*
