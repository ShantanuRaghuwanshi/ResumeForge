# ResumeAI - Intelligent Resume Processing and Enhancement Platform

## Overview

ResumeAI is a full-stack web application that leverages AI/LLM capabilities to parse, analyze, and enhance resumes. The platform provides a comprehensive workflow from file upload to downloadable optimized resumes, with support for multiple AI providers and customizable templates.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for lightweight client-side routing
- **File Handling**: React Dropzone for drag-and-drop file uploads

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for REST API
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **File Processing**: Multer for file upload handling
- **Session Management**: Built-in session handling with connect-pg-simple

### AI/LLM Integration
- **Multi-Provider Support**: OpenAI, Anthropic Claude, Google Gemini, and Ollama
- **Service Pattern**: Abstracted LLM service interface for consistent API across providers
- **Model Defaults**: 
  - OpenAI: gpt-4o
  - Claude: claude-sonnet-4-20250514
  - Gemini: gemini-2.5-flash

## Key Components

### 1. File Upload and Processing
- Supports PDF, DOC, DOCX, and TXT formats
- 10MB file size limit
- Text extraction and cleaning pipeline
- Metadata preservation (filename, size, type)

### 2. LLM Configuration Management
- Dynamic provider selection and configuration
- API key management and validation
- Connection testing before processing
- Support for custom model selection

### 3. Resume Analysis Pipeline
- **Parsing**: Extract structured data from resume text
- **Analysis**: Generate improvement suggestions and scoring
- **Job Matching**: Compare resume against job descriptions
- **Enhancement**: AI-powered content optimization

### 4. Template System
- Multiple professional resume templates
- ATS-friendly designs
- Preview functionality with real-time rendering
- Template selection persistence

### 5. Download and Export
- Multiple format support (PDF, DOCX, TXT)
- Optimized resume generation
- Final content compilation

## Data Flow

1. **Upload Phase**: User uploads resume file → File validation → Text extraction → Storage
2. **Configuration Phase**: LLM provider setup → API validation → Configuration persistence
3. **Analysis Phase**: Resume parsing → AI analysis → Suggestion generation → Job matching (optional)
4. **Enhancement Phase**: Template selection → Content optimization → Final compilation
5. **Export Phase**: Format selection → Document generation → Download delivery

## Database Schema

### Core Tables
- **users**: User authentication and management
- **resumes**: Resume storage with parsed data and analysis results
- **llm_configs**: AI provider configurations per user
- **job_descriptions**: Job postings for matching analysis

### Data Types
- **ParsedResume**: Structured resume data (personal details, experience, education, skills, projects)
- **AnalysisResult**: AI-generated insights, scores, and suggestions
- **LLMConfig**: Provider settings and API credentials

## External Dependencies

### AI/LLM Providers
- OpenAI GPT models for text processing
- Anthropic Claude for advanced analysis
- Google Gemini for alternative AI capabilities
- Ollama for local/self-hosted model support

### Database and Storage
- Neon Database for serverless PostgreSQL hosting
- Drizzle ORM for type-safe database operations
- In-memory storage fallback for development

### UI and Styling
- Radix UI for accessible component primitives
- Tailwind CSS for utility-first styling
- shadcn/ui for pre-built component library

## Deployment Strategy

### Development
- Vite dev server for frontend with HMR
- tsx for TypeScript execution in development
- Environment variable based configuration
- Replit-specific development tooling integration

### Production Build
- Vite build for optimized frontend bundle
- esbuild for server-side compilation
- Static file serving through Express
- Environment-based configuration management

### Database Management
- Drizzle migrations for schema changes
- Connection pooling through Neon serverless
- Backup and recovery through cloud provider

## Architecture Decisions

### Monorepo Structure
**Problem**: Organize full-stack application with shared types and utilities
**Solution**: Single repository with shared schema and types between client/server
**Benefits**: Type safety across boundaries, simplified deployment, shared utilities

### AI Provider Abstraction
**Problem**: Support multiple LLM providers with different APIs
**Solution**: Common interface with provider-specific implementations
**Benefits**: Easy provider switching, consistent error handling, future extensibility

### In-Memory Storage Option
**Problem**: Development and testing without database setup
**Solution**: IStorage interface with both database and memory implementations
**Benefits**: Simplified development workflow, testing isolation, deployment flexibility

### Component-Based UI Architecture
**Problem**: Consistent, accessible, and maintainable user interface
**Solution**: shadcn/ui components with Radix primitives and Tailwind styling
**Benefits**: Accessibility by default, consistent design system, rapid development