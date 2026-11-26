# Fit Letter

Fit Letter is an AI-powered Chrome extension that generates evidence-grounded cover letters by comparing a job posting against a user's resume.

Instead of simply generating generic application text, Fit Letter identifies job requirements, maps them to evidence from the resume, flags unsupported qualifications, and generates a tailored cover letter without intentionally fabricating experience.

## Features

- Extracts job titles and descriptions directly from career pages
- Uses site-specific selectors with a generic semantic fallback for broader compatibility
- Supports manual job description entry when automatic extraction fails
- Parses PDF resumes locally in the browser using PDF.js
- Stores resume, job, preferences, and analysis locally using Chrome Storage
- Identifies key requirements from job postings
- Maps requirements to supporting resume evidence
- Explicitly identifies qualification gaps
- Generates tailored cover letters using the Claude API
- Supports tone and length preferences
- Allows generated letters to be edited and regenerated
- Copies completed letters to the clipboard
- Exports letters as formatted PDFs
- Automatically names PDFs using the candidate and job title
- Persists the current workflow when the extension popup is closed

## How It Works

1. The user opens a job posting and clicks **Read Job Posting**.
2. The content script extracts the job title and description from the page.
3. The user uploads a PDF resume, which is parsed locally with PDF.js.
4. The extension sends the extracted resume text, job posting, and generation preferences to the local backend.
5. The backend calls the Claude API and requests structured analysis.
6. Claude returns:
   - candidate name
   - company name
   - job requirements
   - match/gap status
   - supporting resume evidence
   - tailored cover letter
7. Fit Letter displays the analysis and allows the user to edit, regenerate, copy, or export the letter as a PDF.

## Architecture

```text
Job Posting
     |
     v
Chrome Content Script
     |
     v
Chrome Extension Popup
     |
     +---- PDF.js ---> Local Resume Text
     |
     v
Node.js / Express Backend
     |
     v
Claude API
     |
     v
Structured Analysis
     |
     +---- Requirement / Evidence Mapping
     +---- Match / Gap Detection
     +---- Cover Letter
     |
     v
Chrome Extension
     |
     +---- Editable Letter
     +---- Copy
     +---- jsPDF Export
```

## Tech Stack

**Frontend / Extension**
- JavaScript
- HTML
- CSS
- Chrome Extension Manifest V3
- Chrome Storage API

**Resume Processing**
- PDF.js

**Backend**
- Node.js
- Express
- CORS
- dotenv

**AI**
- Anthropic Claude API
- Structured JSON generation

**Document Export**
- jsPDF

## Evidence-Grounded Generation

A core goal of Fit Letter is reducing unsupported claims in AI-generated cover letters.

For each important job requirement, the model returns a structured result:

```json
{
  "requirement": "Experience with data pipelines",
  "status": "match",
  "evidence": "Built an energy analytics pipeline using Kafka and Apache Spark."
}
```

When evidence is unavailable:

```json
{
  "requirement": "Experience with Databricks",
  "status": "gap",
  "evidence": null
}
```

The generation instructions prevent identified gaps from being presented as existing experience.

## Privacy Design

Resume parsing occurs locally inside the Chrome extension.

The original resume PDF is not uploaded to the backend. Extracted resume text is sent to the local backend only when an analysis is requested and is then provided to the configured AI API for generation.

The Anthropic API key is stored only in the backend `.env` file and is never exposed to extension scripts.

## Running Locally

### Backend

From the `backend` directory:

```bash
npm install
```

Create:

```text
.env
```

Add:

```text
ANTHROPIC_API_KEY=your_api_key
```

Start the backend:

```bash
node index.js
```

The server runs at:

```text
http://localhost:3000
```

### Chrome Extension

1. Open Chrome.
2. Navigate to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the `extension` directory.
6. Open a job posting.
7. Open Fit Letter and click **Read Job Posting**.

## Limitations

- Job-page structures vary across websites, so automatic extraction may not work perfectly on every site.
- Dynamic job interfaces such as some LinkedIn views may require opening the individual job page or using manual entry.
- PDF resumes are currently supported; DOCX parsing is not implemented.
- The backend currently runs locally.
- AI-generated output should still be reviewed before submitting an application.
- The backend validates the structure of the analysis (a "match" must carry evidence, a "gap" must not), but it does not yet check that the quoted evidence actually appears in the resume text.
- No automated tests yet.

## Third-Party Libraries

`extension/lib/` bundles [PDF.js](https://github.com/mozilla/pdf.js) (Apache-2.0, Mozilla Foundation) and [jsPDF](https://github.com/parallax/jsPDF) (MIT). Their license headers are kept in the files.

## Future Improvements

Potential future versions could include:

- More robust cross-site job extraction
- DOCX resume support
- Improved PDF formatting
- Additional generation controls
- Multiple resume profiles
- Optional application history

## Project Goal

Fit Letter was built to explore how browser automation, local document processing, structured LLM output, and evidence-grounded generation can be combined into a practical job-application workflow.