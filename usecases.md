\# Use-case Narrative: Auto-Flashcards — Generate \& Review Smart Flashcards



> Project: AUTO-FLASHCARDS  

> Owner: SA/PO  

> Author: Fullstack Developer  

> Priority: CRITICAL  

> Based on: D1 (PRD), D3 (Stakeholders), D4 (RACI)



---



\## 1. Happy Path — Upload PDF → Generate Cards → Review with Spaced Repetition



1\. User (University Student or MOOC Learner) opens the app.

2\. Uploads a lecture PDF (RU/EN) via drag-and-drop.

3\. System shows: “Processing your file... ⏳” with progress bar.

4\. Backend (FastAPI) triggers:

&nbsp;  - Text extraction (OCR if scanned PDF)

&nbsp;  - LLM/NLP generates 15–30 Q\&A flashcards

&nbsp;  - Cards saved to Postgres DB

5\. System displays: “✅ 27 flashcards generated in 42 seconds!”

6\. User clicks “Start Today’s Review”.

7\. Spaced Repetition (SM-2) engine shows first card:  

&nbsp;  > \*\*Q:\*\* What is cognitive load?  

&nbsp;  > \*(User clicks “Show Answer”)\*  

&nbsp;  > \*\*A:\*\* The total amount of mental effort being used in working memory.

8\. User rates recall: 0 (Forgot) → 5 (Perfect) → System schedules next review.

9\. After reviewing all scheduled cards, dashboard updates:

&nbsp;  - “You reviewed 30 cards today 🎯”

&nbsp;  - Progress chart: “87% correct this week”

10\. Session ends. User closes app satisfied.



> \*\*⏱️ User Value\*\*: Saves 1–2 hours of manual work + boosts retention via science → \*\*Better exam results\*\*.



---



\## 2. Alternative Flows



\### 2.1 No Internet During Upload or Review



\- User tries to upload → “No internet. Retry when online?”

\- App caches file locally → auto-retries upload when back online.

\- During review: offline mode → user reviews existing cards → syncs ratings later.



> \*\*📶 User Value\*\*: Study anywhere — metro, dorm, airplane → \*\*Uninterrupted learning\*\*.



\### 2.2 Poor Quality PDF / OCR Fails



\- System detects low-quality scan → shows warning:  

&nbsp; > “Hard to read. Results may be inaccurate. Proceed?”

\- If user proceeds → cards generated with disclaimer: “⚠️ Auto-generated from low-quality source. Please edit.”

\- User can manually edit/delete bad cards.



> \*\*🧐 User Value\*\*: Transparency + control → \*\*Builds trust, reduces frustration\*\*.



---



\## 3. Error Handling



\### 3.1 Technical Failure — LLM or Backend Crash



\- During generation → FastAPI returns 500 error.

\- Frontend shows:  

&nbsp; > “Oops! Couldn’t generate cards. Our team is notified. Try again in 2 min?”

\- Error logged in Langfuse → alert sent to MLOps \& Fullstack.



> \*\*🛡️ User Value\*\*: Professional handling → \*\*Maintains trust and brand image\*\*.



\### 3.2 Invalid Input — Corrupted or Non-PDF File



\- User uploads .exe or 500MB video → Frontend blocks:  

&nbsp; > “Please upload a PDF/text file under 50MB.”

\- If bypassed → Backend rejects with 400: “Unsupported file format.”



> \*\*🚫 User Value\*\*: Instant feedback → \*\*Reduces support tickets and user errors\*\*.



\### 3.3 Limit Exceeded — Too Many Cards or Sessions



\- User tries to generate 500 cards → System caps at 50 per session:  

&nbsp; > “Let’s stay focused! Max 50 cards per upload. Split your file?”

\- Or: Reviews 100 cards in 5 min → System pauses:  

&nbsp; > “Take a breath! Spaced repetition works best with focus. Resume in 2 min?”



> \*\*🧠 User Value\*\*: Enforces healthy habits → \*\*Improves long-term retention\*\*.



---



\## 4. User Value Summary



| Scenario                  | User Value Delivered                          |

|---------------------------|-----------------------------------------------|

| Happy Path                | ⏱️ Saves time + better exam results          |

| No Internet               | 📶 Uninterrupted learning anywhere            |

| Poor PDF Quality          | 🧐 Transparency + control                     |

| Technical Failure         | 🛡️ Professional error handling               |

| Invalid Input             | 🚫 Reduces confusion and errors              |

| Limit Exceeded            | 🧠 Encourages effective, science-backed study |



---



\## 5. Use-case UML Diagram (PlantUML Code — بالإنجليزي)



```plantuml

@startuml

left to right direction

actor "Student / MOOC Learner" as User



rectangle "Auto-Flashcards System" {

&nbsp; User --> (Upload PDF)

&nbsp; User --> (Review Flashcards)

&nbsp; User --> (Edit/Delete Cards)

&nbsp; User --> (View Progress Dashboard)



&nbsp; (Upload PDF) --> (Extract Text) : includes

&nbsp; (Extract Text) --> (Generate Q\&A Cards) : triggers

&nbsp; (Generate Q\&A Cards) --> (Save to DB) : stores



&nbsp; (Review Flashcards) --> (Rate Recall 0-5) : includes

&nbsp; (Rate Recall 0-5) --> (Schedule Next Review) : triggers SM-2



&nbsp; (Upload PDF) --> (Handle Low Quality PDF) : alt

&nbsp; (Upload PDF) --> (Handle No Internet) : alt



&nbsp; (Review Flashcards) --> (Handle Offline Mode) : alt

&nbsp; (Upload PDF) --> (Reject Invalid File) : error

&nbsp; (Generate Q\&A Cards) --> (Handle LLM Crash) : error

}



note right of (Upload PDF)

&nbsp; MVP: PDF only, <50MB, RU/EN

end note



note right of (Review Flashcards)

&nbsp; Uses SM-2 algorithm

&nbsp; Offline capable

end note

@enduml

