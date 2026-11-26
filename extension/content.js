function cleanText(text) {
  return text
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function getJobTitle() {
  const selectors = [
    '[class*="job-title"]',
    '[class*="jobTitle"]',
    '[id*="job-title"]',
    '[id*="jobTitle"]',
    '[data-testid*="job-title"]',

    
    "main h1",
    "article h1",

    
    "h1"
  ];

  const badTitlePhrases = [
    "step forward with us",
    "join our team",
    "careers",
    "career opportunities",
    "welcome",
    "search jobs",
    "find your future"
  ];

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);

    for (const element of elements) {
      const text = cleanText(
        element.innerText || ""
      );

      if (!text) {
        continue;
      }

      const lowerText = text.toLowerCase();

      const looksGeneric =
        badTitlePhrases.some(
          phrase => lowerText === phrase
        );

      if (looksGeneric) {
        continue;
      }

      // Job titles are normally relatively short.
      if (
        text.length >= 3 &&
        text.length <= 150
      ) {
        return text;
      }
    }
  }

  // Try page metadata
  const metaTitle =
    document.querySelector(
      'meta[property="og:title"]'
    )?.content;

  if (metaTitle) {
    return cleanText(metaTitle);
  }

  return "Job title not detected";
}

function getJobDescription() {
  const selectors = [
    // LinkedIn
    ".jobs-description__content",
    ".jobs-box__html-content",

    // Indeed
    "#jobDescriptionText",

    // Greenhouse
    "#content",
    ".job__description",

    // Lever
    ".posting-page .content",
    ".section-wrapper",

    // Generic career sites
    '[class*="job-description"]',
    '[class*="jobDescription"]',
    '[id*="job-description"]',
    '[id*="jobDescription"]',
    '[data-testid*="job-description"]'
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);

    if (
      element?.innerText &&
      element.innerText.trim().length > 200
    ) {
      return cleanText(element.innerText);
    }
  }

  // Fallback for sites we do not recognize
  return getFallbackDescription();
}

function getFallbackDescription() {
  const candidates = [
    ...document.querySelectorAll(
      "main, article, section"
    )
  ];

  let bestElement = null;
  let bestScore = 0;

  const keywords = [
    "responsibilities",
    "requirements",
    "qualifications",
    "experience",
    "skills",
    "what you'll do",
    "what you will do",
    "about the role"
  ];

  for (const element of candidates) {
    const text = cleanText(
      element.innerText || ""
    );

    if (text.length < 300) {
      continue;
    }

    const lowerText = text.toLowerCase();

    let keywordScore = 0;

    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        keywordScore++;
      }
    }

    const score =
      keywordScore * 1000 +
      Math.min(text.length, 10000);

    if (score > bestScore) {
      bestScore = score;
      bestElement = element;
    }
  }

  if (bestElement) {
    return cleanText(bestElement.innerText);
  }

  // Last resort
  return cleanText(document.body.innerText);
}

function getJobData() {
  const title = getJobTitle();
  const description = getJobDescription();

  const isLinkedInSearch =
    window.location.hostname.includes("linkedin.com") &&
    window.location.pathname.includes("/jobs/search");

  if (isLinkedInSearch) {
    return {
      title: "Open the full job posting",
      description:
        "Fit Letter works best from the individual job posting or company application page.",
      url: window.location.href
    };
  }

  return {
    title,
    description,
    url: window.location.href
  };
}
chrome.runtime.onMessage.addListener(
  (request, sender, sendResponse) => {

    if (request.action === "getJobText") {
      sendResponse(getJobData());
    }

  }
);