import * as pdfjsLib from "./lib/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  chrome.runtime.getURL("lib/pdf.worker.mjs");


// ========================================
// HTML ELEMENTS
// ========================================

const button = document.getElementById("readJob");
const jobText = document.getElementById("jobText");
const jobTitle = document.getElementById("jobTitle");

const resumeUpload = document.getElementById("resumeUpload");
const resumeStatus = document.getElementById("resumeStatus");

const analyzeButton = document.getElementById("analyzeButton");
const analyzeStatus = document.getElementById("analyzeStatus");
const analysisResults = document.getElementById("analysisResults");

const letterSection =document.getElementById("letterSection");
const letterText = document.getElementById("letterText");
const copyLetter = document.getElementById("copyLetter");

const tone = document.getElementById("tone");
const length = document.getElementById("length");

const regenerateLetter = document.getElementById("regenerateLetter");
const downloadLetter = document.getElementById("downloadLetter")

const manualJobButton = document.getElementById("manualJobButton");
const manualJobSection = document.getElementById("manualJobSection");
const manualJobTitle = document.getElementById("manualJobTitle");
const manualJobDescription = document.getElementById("manualJobDescription");
const saveManualJob = document.getElementById("saveManualJob");
// ========================================
// READ JOB POSTING
// ========================================

button.addEventListener("click", () => {

  chrome.tabs.query(
    {
      active: true,
      currentWindow: true
    },

    (tabs) => {

      const tab = tabs[0];

      chrome.tabs.sendMessage(
        tab.id,
        { action: "getJobText" },

        (response) => {

          if (chrome.runtime.lastError) {

            console.error(chrome.runtime.lastError);

            jobText.textContent =
              "Could not read this page. Try refreshing the page.";

            return;
          }


          if (!response) {

            jobText.textContent =
              "No job information found.";

            return;
          }


          // Display the job
          jobTitle.textContent = response.title;
          jobText.textContent = response.description;


          // Save the job
          chrome.storage.local.set({

            currentJob: {
              title: response.title,
              description: response.description
            }

          }, async () => {

            await chrome.storage.local.remove(
                "latestAnalysis"
            );

            analysisResults.innerHTML = "";

            letterText.value = "";

            letterSection.style.display = "none";

            analyzeStatus.textContent =
                "Job saved. Ready to analyze.";

          });

        }
      );

    }
  );

});


// ========================================
// PDF RESUME PARSER
// ========================================

async function extractPdfText(file) {

  const arrayBuffer = await file.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer
  }).promise;

  let fullText = "";


  for (
    let pageNumber = 1;
    pageNumber <= pdf.numPages;
    pageNumber++
  ) {

    const page =
      await pdf.getPage(pageNumber);

    const textContent =
      await page.getTextContent();

    const pageText =
      textContent.items
        .map(item => item.str)
        .join(" ");

    fullText += pageText + "\n";

  }


  return fullText.trim();
}


// ========================================
// RESUME UPLOAD
// ========================================

resumeUpload.addEventListener(
  "change",
  async () => {

    const file =
      resumeUpload.files[0];


    if (!file) {
      return;
    }


    if (file.type !== "application/pdf") {

      resumeStatus.textContent =
        "For now, please upload a PDF resume.";

      return;
    }


    try {

      resumeStatus.textContent =
        "Reading resume...";


      const resumeText =
        await extractPdfText(file);


      await chrome.storage.local.set({

        resume: {
          name: file.name,
          text: resumeText,
          savedAt: Date.now()
        }

      });


      resumeStatus.textContent =
        `Saved locally: ${file.name}`;

      


    } catch (error) {

      console.error(
        "Resume parsing failed:",
        error
      );

      resumeStatus.textContent =
        "Could not read this PDF.";

    }

  }
);


// ========================================
// LOAD SAVED RESUME
// ========================================

async function loadSavedResume() {

  const result =
    await chrome.storage.local.get("resume");


  if (result.resume) {

    resumeStatus.textContent =
      `Saved resume: ${result.resume.name}`;

  }

}


// ========================================
// ANALYZE FIT
// ========================================
function displayAnalysis(result){
        analyzeStatus.textContent = "Analysis complete!";
        analysisResults.innerHTML = "";
        const matches = result.requirements.filter( item => item.status === "match").length;
        const total = result.requirements.length;
        const summary = document.createElement("div");
        
        summary.innerHTML = `
            <h3>Fit Analysis</h3>

            <p>
                <strong>${result.companyName}</strong>
            </p>

            <p>
                <strong>${matches}/${total}</strong>
                requirements supported by your resume.
            </p>
        `;

        analysisResults.appendChild(summary);
        result.requirements.forEach((item)=>{
            const card = document.createElement("div");
            card.className = "requirement-card";
            const statusText = item.status === "match" ? "MATCH" : "GAP";
            const statusClass = item.status === "match" ? "match" : "gap";
            card.innerHTML = `
                <div class="requirement-header">

                <div class="requirement-title">
                    ${item.requirement}
                </div>

                <span class="status ${statusClass}">
                    ${statusText}
                </span>

                </div>

                <div class="evidence-label">
                Resume evidence
                </div>

                <p class="evidence">
                ${
                    item.evidence
                    ? item.evidence
                    : "No supporting evidence found in resume."
                }
                </p>

                ${
                item.status === "gap"
                    ? `
                    <div class="gap-warning">
                        This requirement will not be claimed as experience.
                    </div>
                    `
                    : ""
                }
            `;
            analysisResults.appendChild(card);
        });
        letterText.value = result.letter;
        letterSection.style.display = "block";
}

analyzeButton.addEventListener("click",async () => {

    try {
      analyzeButton.disabled = true;
      analyzeButton.textContent = "Analyzing...";
      analyzeStatus.textContent = "Checking data...";


      const data =
        await chrome.storage.local.get([
          "resume",
          "currentJob"
        ]);



      if (!data.resume) {

        analyzeStatus.textContent =
          "Please upload a resume first.";

        return;
      }


      if (!data.currentJob) {

        analyzeStatus.textContent =
          "Please read a job posting first.";

        return;
      }


      analyzeStatus.textContent =
        "Sending to backend...";


      const response =
        await fetch(
          "http://localhost:3000/analyze",
          {

            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({

              job: data.currentJob,
              resume:data.resume.text,
              options: {
                tone: tone.value,
                length: length.value
              }

            })

          }
        );


      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "AI analysis failed." );
      }
     

      await chrome.storage.local.set({latestAnalysis: result});
    
      displayAnalysis(result);
      function displayAnalysis(result){
        analyzeStatus.textContent = "Analysis complete!";
        analysisResults.innerHTML = "";
        const matches = result.requirements.filter( item => item.status === "match").length;
        const total = result.requirements.length;
        const summary = document.createElement("div");

        summary.innerHTML = `
            <h3>Fit Analysis</h3>

            <p>
                <strong>${matches}/${total}</strong>
                requirements supported by your resume.
            </p>
        `;

        analysisResults.appendChild(summary);
        result.requirements.forEach((item)=>{
            const card = document.createElement("div");
            card.className = "requirement-card";
            const statusText = item.status === "match" ? "MATCH" : "GAP";
            const statusClass = item.status === "match" ? "match" : "gap";
            card.innerHTML = `
                <div class="requirement-header">

                <div class="requirement-title">
                    ${item.requirement}
                </div>

                <span class="status ${statusClass}">
                    ${statusText}
                </span>

                </div>

                <div class="evidence-label">
                Resume evidence
                </div>

                <p class="evidence">
                ${
                    item.evidence
                    ? item.evidence
                    : "No supporting evidence found in resume."
                }
                </p>

                ${
                item.status === "gap"
                    ? `
                    <div class="gap-warning">
                        This requirement will not be claimed as experience.
                    </div>
                    `
                    : ""
                }
            `;
            analysisResults.appendChild(card);
        });
        letterText.value = result.letter;
        letterSection.style.display = "block";
      }

    } catch (error) {

      console.error(
        "Analyze error:",
        error
      );

      analyzeStatus.textContent =
        "Could not connect to backend.";

    }
    finally {
        analyzeButton.disabled = false;
        analyzeButton.textContent = "Analyze Fit";
    }

  }
);

copyLetter.addEventListener("click", async () => {

  await navigator.clipboard.writeText(
    letterText.value
  );

  copyLetter.textContent = "Copied!";

  setTimeout(() => {
    copyLetter.textContent = "Copy Letter";
  }, 1500);

});

async function loadLatestAnalysis() {
  try {
    const data = await chrome.storage.local.get(
      "latestAnalysis"
    );

    

    if (data.latestAnalysis) {
      displayAnalysis(data.latestAnalysis);
    }

  } catch (error) {
    console.error(
      "Could not restore analysis:",
      error
    );
  }
}

regenerateLetter.addEventListener("click", async () => {
  try {
    regenerateLetter.textContent = "Generating...";
    regenerateLetter.disabled = true;

    const data = await chrome.storage.local.get([
      "resume",
      "currentJob",
      "latestAnalysis"
    ]);

    if (
      !data.resume ||
      !data.currentJob ||
      !data.latestAnalysis
    ) {
      return;
    }

    const response = await fetch(
      "http://localhost:3000/regenerate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          job: data.currentJob,
          resume: data.resume.text,
          requirements:
            data.latestAnalysis.requirements,
          options: {
            tone: tone.value,
            length: length.value
          }
        })
      }
    );

    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error || "AI analysis failed.");
    }

    if (!response.ok) {
      throw new Error(
        result.error || "Regeneration failed."
      );
    }

    letterText.value = result.letter;

    data.latestAnalysis.letter = result.letter;

    await chrome.storage.local.set({
      latestAnalysis: data.latestAnalysis
    });

  } catch (error) {
    console.error(error);
    analyzeStatus.textContent =
      "Could not regenerate letter.";
  } finally {
    regenerateLetter.textContent =
      "Regenerate Letter";

    regenerateLetter.disabled = false;
  }
});

downloadLetter.addEventListener("click", async () => {
  const text = letterText.value.trim();

  if (!text) {
    analyzeStatus.textContent ="No cover letter to download.";
    return;
  }

  const data = await chrome.storage.local.get([
    "latestAnalysis",
    "currentJob"
  ]);

  const candidateName =
    data.latestAnalysis?.candidateName ||
    "Candidate";

  const jobTitle =
    data.currentJob?.title ||
    "Job";

  const { jsPDF } = window.jspdf;

  const doc = new jsPDF({
    unit: "pt",
    format: "letter"
  });

  const margin = 72;
  const pageWidth =
    doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const lines = doc.splitTextToSize(
    text,
    pageWidth - margin * 2
  );

  let y = margin;

  for (const line of lines) {
    if (y > 720) {
      doc.addPage();
      y = margin;
    }

    doc.text(line, margin, y);
    y += 16;
  }

  const cleanName = candidateName
    .replace(/[<>:"/\\|?*]/g, "")
    .trim();

  const cleanJobTitle = jobTitle
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\)+$/, "")
    .trim();

  const filename =
    `${cleanName} - ${cleanJobTitle} - Cover Letter.pdf`;

  doc.save(filename);
});

async function saveOptions() {
  await chrome.storage.local.set({
    letterOptions: {
      tone: tone.value,
      length: length.value
    }
  });
}

tone.addEventListener("change", saveOptions);
length.addEventListener("change", saveOptions);

async function loadOptions() {
  const data =  await chrome.storage.local.get("letterOptions");

  if (data.letterOptions) {
    tone.value = data.letterOptions.tone || "professional";
    length.value = data.letterOptions.length || "medium";
  }
}

manualJobButton.addEventListener("click", () => {
  const isHidden =
    manualJobSection.style.display === "none";

  manualJobSection.style.display =
    isHidden ? "block" : "none";
});

saveManualJob.addEventListener("click", async () => {
  const title = manualJobTitle.value.trim();
  const description =
    manualJobDescription.value.trim();

  if (!title || !description) {
    analyzeStatus.textContent =
      "Enter both a job title and description.";
    return;
  }

  const currentJob = {
    title,
    description,
    url: null
  };

  await chrome.storage.local.set({
    currentJob
  });

  await chrome.storage.local.remove(
    "latestAnalysis"
  );

  jobTitle.textContent = title;
  jobText.textContent = description;

  analysisResults.innerHTML = "";
  letterText.value = "";
  letterSection.style.display = "none";

  manualJobSection.style.display = "none";

  analyzeStatus.textContent =
    "Manual job saved. Ready to analyze.";
});

async function loadSavedJob() {
  const data =
    await chrome.storage.local.get("currentJob");

  if (data.currentJob) {
    jobTitle.textContent =
      data.currentJob.title;

    jobText.textContent =
      data.currentJob.description;
  }
}

async function initializePopup() {
  await loadSavedResume();
  await loadOptions();
  await loadLatestAnalysis();
  await loadSavedJob();
}

initializePopup();