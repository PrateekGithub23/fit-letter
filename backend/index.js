require("dotenv").config();

const express = require("express");
const cors = require("cors");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();

app.use(cors());
app.use(express.json());

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});


// ================================
// HEALTH CHECK
// ================================

app.get("/", (req, res) => {

  res.json({
    message: "Fit Letter backend is running"
  });

});

function validateAnalysis(analysis) {
  if (!analysis || typeof analysis !== "object") {
    return false;
  }

  if (typeof analysis.companyName !== "string" || !analysis.companyName.trim()){
    return false;
  }

  if (typeof analysis.candidateName !== "string" || !analysis.candidateName.trim()){
    return false;
  }
  if (!Array.isArray(analysis.requirements)) {
    return false;
  }

  if (
    typeof analysis.letter !== "string" ||
    !analysis.letter.trim()
  ) {
    return false;
  }

  if (analysis.requirements.length === 0) {
    return false;
  }

  for (const item of analysis.requirements) {

    if (
      typeof item.requirement !== "string" ||
      !item.requirement.trim()
    ) {
      return false;
    }

    if (
      item.status !== "match" &&
      item.status !== "gap"
    ) {
      return false;
    }

    if (
      item.status === "match" &&
      (typeof item.evidence !== "string" ||
        !item.evidence.trim())
    ) {
      return false;
    }

    if (
      item.status === "gap" &&
      item.evidence !== null
    ) {
      return false;
    }
  }

  return true;
}

// ================================
// ANALYZE
// ================================

app.post("/analyze", async (req, res) => {

  try {

    const { job, resume, options } = req.body;

    if (!job || !resume) {

      return res.status(400).json({
        error: "Job and resume are required."
      });

    }

    const prompt = `
You are the analysis engine for Fit Letter, a cover-letter tool for students.

JOB TITLE:
${job.title}

JOB DESCRIPTION:
${job.description}

RESUME:
${resume}

LETTER OPTIONS:
Tone: ${options?.tone || "professional"}
Length: ${options?.length || "medium"}

TASK:

1. Identify the 5-6 most important requirements from the job posting.

2. Compare each requirement against the resume.

3. Mark a requirement "match" ONLY when the resume contains concrete supporting evidence.

4. Otherwise mark it "gap".

5. Never invent skills, experience, technologies, education, achievements, or responsibilities.

6. Evidence must be a concise factual excerpt or close paraphrase of information actually contained in the resume.

7. Write a cover letter using ONLY supported resume evidence.

8. Do not claim that the candidate has experience with requirements marked as gaps.

9. Follow the requested tone and length.

10. Extract the candidate's full name from the resume. Never infer or invent a name.

11. Identify the company name from the job posting. If the company name is clearly present, return it exactly and do not invent one.

12. Address the cover letter naturally to the company's hiring team when appropriate. Do not invent a hiring manager's name.
Return ONLY valid JSON using exactly this structure:

{
  "candidateName": "candidate's full name from the resume",
  "companyName": "company name from the job posting",
  "requirements": [
    {
      "requirement": "requirement text",
      "status": "match",
      "evidence": "resume evidence"
    },
    {
      "requirement": "requirement text",
      "status": "gap",
      "evidence": null
    }
  ],
  "letter": "complete cover letter"
}
`;


    const message = await anthropic.messages.create({

      model: "claude-sonnet-4-6",

      max_tokens: 2000,

      messages: [
        {
          role: "user",
          content: prompt
        }
      ]

    });


    let responseText =
      message.content[0].text.trim();


    // Remove markdown fences if the model returns them.
    responseText = responseText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/\s*```$/, "");


    const analysis = JSON.parse(responseText);

    if (!validateAnalysis(analysis)) {
    throw new Error(
        "Claude returned an invalid analysis structure."
    );
    }
    res.json(analysis);

  } catch (error) {

    console.error("Analysis failed:", error);

    res.status(500).json({
      error: "AI analysis failed. Please try again."
    });

  }

});

app.post("/regenerate", async (req, res) => {
  try {
    const {
      job,
      resume,
      requirements,
      options
    } = req.body;

    if (!job || !resume || !requirements) {
      return res.status(400).json({
        error: "Missing required data."
      });
    }

    const prompt = `
You are writing a cover letter for a student.

JOB:
${job.title}

${job.description}

RESUME:
${resume}

VERIFIED REQUIREMENTS:
${JSON.stringify(requirements, null, 2)}

Tone: ${options?.tone || "professional"}
Length: ${options?.length || "medium"}

Write a new cover letter using ONLY evidence supported by
the resume and verified requirements.

Do not invent experience, skills, achievements, or qualifications.
Do not claim experience for requirements marked "gap".

Return ONLY the cover letter text.
`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const letter = message.content[0].text.trim();

    res.json({ letter });

  } catch (error) {
    console.error("Regeneration failed:", error);

    res.status(500).json({
      error: "Could not regenerate letter."
    });
  }
});
// ================================
// START SERVER
// ================================

const PORT = 3000;

app.listen(PORT, () => {

  console.log(
    `Fit Letter backend running on http://localhost:${PORT}`
  );

});