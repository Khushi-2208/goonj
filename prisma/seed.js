/* eslint-disable */
const fs = require('fs');
const path = require('path');

// Parse .env manually at startup
try {
  const envContent = fs.readFileSync(path.resolve('.env'), 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const firstEq = trimmed.indexOf('=');
    if (firstEq === -1) continue;
    const key = trimmed.slice(0, firstEq).trim();
    let val = trimmed.slice(firstEq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
} catch (e) {
  console.error('Failed to load .env manually:', e.message);
}

const { PrismaClient } = require('@prisma/client');
const { GoogleGenAI } = require('@google/genai');

// Initialize Prisma
const prisma = new PrismaClient();

// Initialize Gemini
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const SAMPLE_SCHEMES = [
  {
    title: "PM Kisan Samman Nidhi",
    ministry: "Ministry of Agriculture and Farmers Welfare",
    state: "Central",
    minAge: 18,
    maxAge: 100,
    genderRestriction: "All",
    incomeCeiling: 300000,
    occupations: "farmer",
    casteCategories: "General, OBC, SC, ST",
    expiryDate: new Date("2030-12-31"),
    documentUrl: "Official Portal: pmkisan.gov.in",
    applicationSteps: "1. Visit pmkisan.gov.in and click New Farmer Registration. 2. Enter Aadhaar card and select state. 3. Input land records ownership details. 4. Submit bank account credentials. 5. Keep copy of application receipt for verification.",
    guidelines: `
The Pradhan Mantri Kisan Samman Nidhi (PM-KISAN) is a Central Sector Scheme to provide income support to all landholding farmers' families in the country.
Under the Scheme, an income support of Rs. 6,000/- per year is provided to all landholding farmer families in three equal installments of Rs. 2,000/- every four months.
Eligibility Criteria:
- All landholding farmers' families are eligible. A farmer's family is defined as husband, wife and minor children.
- The landholder must reside in India.
- Exclusions: Institutional landholders, professional persons (doctors, engineers, lawyers), retired pensioners drawing Rs 10,000 or more, and income tax payers in the last assessment year.
Application Steps:
- Farmers need to register on the official portal pmkisan.gov.in.
- Required documents include Aadhaar Card, Land ownership records (Khasra/Khatauni), Bank passbook, and mobile number.
- Verification is processed by the local revenue authorities or agriculture department block officers.
`
  },
  {
    title: "Mukhyamantri Yuva Sambal Yojana",
    ministry: "Department of Skill, Employment and Entrepreneurship",
    state: "Rajasthan",
    minAge: 21,
    maxAge: 35,
    genderRestriction: "All",
    incomeCeiling: 200000,
    occupations: "unemployed",
    casteCategories: "General, OBC, SC, ST",
    expiryDate: new Date("2029-05-15"),
    documentUrl: "Rajasthan Employment Portal",
    applicationSteps: "1. Log into Rajasthan SSO portal and navigate to Employment Service. 2. Upload graduation degree certificates. 3. Submit family income certificate (Form I and K) demonstrating under 2 Lakhs. 4. Register for the mandatory 3-month skill training. 5. Confirm monthly unemployment allowance approval status.",
    guidelines: `
The Mukhyamantri Yuva Sambal Yojana (MYSY) is a state-sponsored welfare program in Rajasthan that offers financial assistance to educated unemployed youth.
Benefits:
- Unemployed male applicants receive Rs 4,000 per month.
- Unemployed female, transgender, and specially-abled applicants receive Rs 4,500 per month.
- The allowance is provided for a maximum duration of two years or until employment is secured, whichever is earlier.
Eligibility Rules:
- The applicant must be a resident of Rajasthan.
- The applicant must hold a Bachelor's degree (Graduation) from a recognized university.
- The annual family income must be less than Rs 2,00,000.
- Age limit: 21 to 30 years for general category, and 21 to 35 years for SC, ST, women, and physically disabled applicants.
- Applicants must undergo mandatory 4 hours of daily internship at government offices and register for skill courses.
`
  },
  {
    title: "Lado Protsahan Yojana",
    ministry: "Department of Women and Child Development",
    state: "Rajasthan",
    minAge: 0,
    maxAge: 18,
    genderRestriction: "Female",
    incomeCeiling: 250000,
    occupations: "student",
    casteCategories: "SC, ST, OBC, General",
    expiryDate: new Date("2031-08-30"),
    documentUrl: "Official Portal: wcd.rajasthan.gov.in",
    applicationSteps: "1. Apply at the local Anganwadi center or online via WCD portal. 2. Provide girl child birth certificate and Jan Aadhaar Card. 3. Input parent's income affidavit. 4. Collect savings bond certificates distributed at key educational milestones: birth, class 1, class 6, class 9, class 11, and college graduation.",
    guidelines: `
Lado Protsahan Yojana is a social benefit scheme launched in Rajasthan to promote girl child education and curb female infanticide.
Under this scheme, a financial bond of Rs. 2,00,000 (Two Lakhs) is provided to families belonging to low-income brackets upon the birth of a girl child.
Benefits distribution timeline:
- The total amount of 2 Lakhs is distributed as savings certificates at various milestone stages:
- Stage 1: Rs 2,000 at birth.
- Stage 2: Rs 5,000 on entering Class 1.
- Stage 3: Rs 6,000 on entering Class 6.
- Stage 4: Rs 10,000 on entering Class 9.
- Stage 5: Rs 15,000 on entering Class 11.
- Stage 6: Rs 50,000 on passing Class 12 or turning 18.
- Stage 7: The remaining bulk is paid on graduation completion or age 21.
Eligibility Conditions:
- The girl child must be born in Rajasthan after the scheme's commencement.
- The family must have a valid Jan Aadhaar Card.
- The family's annual income must not exceed Rs 2.5 Lakhs.
`
  }
];

async function seed() {
  if (!apiKey) {
    console.warn("WARNING: GEMINI_API_KEY is not set in environment. Skipping vector seed generation. You can feed schemes manually via the Admin Dashboard UI.");
    return;
  }

  console.log("Seeding databases...");
  try {
    // Clean current db (schemeVector will cascade delete, but we can clear explicitly first)
    await prisma.schemeVector.deleteMany({});
    await prisma.scheme.deleteMany({});
    
    let totalVectorsCount = 0;

    for (const data of SAMPLE_SCHEMES) {
      const { guidelines, ...metadata } = data;
      
      // 1. Save scheme in SQLite
      const scheme = await prisma.scheme.create({
        data: metadata
      });
      console.log(`Created scheme metadata: ${scheme.title}`);

      // 2. Split guidelines into chunks
      // Simple splitter
      const chunks = guidelines
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 50);

      // 3. Generate embeddings
      for (const chunk of chunks) {
        console.log(`Generating embedding for chunk: "${chunk.substring(0, 40)}..."`);
        const response = await ai.models.embedContent({
          model: 'gemini-embedding-2',
          contents: chunk,
        });

        if (response.embeddings?.[0]?.values) {
          await prisma.schemeVector.create({
            data: {
              schemeId: scheme.id,
              text: chunk,
              embedding: JSON.stringify(response.embeddings[0].values)
            }
          });
          totalVectorsCount++;
        }
      }
    }

    console.log(`Successfully seeded ${SAMPLE_SCHEMES.length} schemes with ${totalVectorsCount} vector embeddings in the database!`);

  } catch (error) {
    console.error("Error seeding databases:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
