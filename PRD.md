# Product Requirements Document (PRD): Schafer Family Cookbook

## 1. Overview
The **Schafer Family Cookbook** is a premium digital archive designed to preserve and celebrate the culinary heritage of the Schafer family. It combines modern web technologies with AI to create a seamless, interactive experience for family members.

## 2. Target Audience
- **Primary**: Members of the Schafer family.
- **Secondary**: Descendants and future generations looking to reconnect with family traditions.

## 3. Core Features

### 3.1 Recipe Archive
- **Browse Recipes**: Grid-based view with high-quality imagery and category filters (Breakfast, Main, Dessert, etc.).
- **Detailed Recipe View**: Full ingredient lists, stepped instructions, and prep/cook times.
- **Alphabetical Index**: A quick-access table of all recipes sorted A-Z.

### 3.2 Family Gallery
- **Visual Memories**: A dedicated space for archival family photos and culinary snapshots.
- **Captions**: Every image supports a descriptive caption to preserve context.

### 3.3 Interactive Trivia
- **Family History**: A repository of trivia questions designed to test knowledge of Schafer history and traditions.
- **Participation**: Family members can answer questions and see immediate feedback.

### 3.4 Contributor Profiles
- **Directory**: A circular avatar-based directory of all family members who have contributed to the archive.
- **Association**: Recipes and trivia are linked to their respective contributors.

## 4. Admin & Contributor Features

### 4.1 AI-Powered Tools (Magic Import)
- **Gemini Integration**: Admins can paste raw recipe text (from old cards or emails) and use AI to automatically structure it into JSON for the archive.
- **Imagen Integration**: Generate appetizing dish photos using AI if a heritage photo isn't available.

### 4.2 Content Management
- **Manual Entry**: Forms for adding recipes, gallery items, and trivia.
- **Image Upload**: Support for uploading heritage photos directly to cloud storage (Firebase).
- **Edit/Delete**: Full CRUD capabilities for authorized admins.

### 4.3 Access Control (New)
- **Role-Based Access (RBAC)**: 
    - **User**: Read-only access to all content, can browse and take trivia.
    - **Admin**: Full access to the "Admin Archive" command center, role management, and content creation tools.
- **Identity Verification**: Simple name-based login with profile photo generation and persistence via `localStorage`.
- **Role Management**: Admins can promote/demote other users directly from the Family Directory.

## 5. Technical Specifications
- **Frontend**: React + Vite (Typescript)
- **Styling**: Tailwind CSS (Premium "Archive" aesthetic)
- **Database/Storage**: Firebase (Firestore for data, Storage for images)
- **Deployment**: Vercel (Production)
- **AI Engine**: Google Gemini (Flash & Imagen 3)

## 6. Access Information
- **Production URL**: [https://schafer-family-cookbook.vercel.app](https://schafer-family-cookbook.vercel.app)
- **Verification**: Login as "Admin" for full administrative privileges.
