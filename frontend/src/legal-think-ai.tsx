import type React from "react"
import { useState, useEffect, useRef } from "react"
import axios from "axios"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast, ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import { Avatar } from "@/components/ui/avatar"
import { Search, FileText, MessageSquare, Settings, Paperclip, Send, LogOut, X, UserPlus, LogIn, Menu, Plus, FolderPlus, Trash2, ChevronDown, ChevronRight, ArrowLeft, ArrowRight, Download, MoreVertical, Edit, Star, Copy, Bold, Italic, Underline, Type, AlignLeft, AlignCenter, AlignRight, AlignJustify, Eye, BookOpen, Maximize2, Minimize2, Scale , Share2 } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { GoogleGenerativeAI } from "@google/generative-ai"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import TextAlign from "@tiptap/extension-text-align"
import ReactMarkdown from "react-markdown"
import { Textarea } from "@/components/ui/textarea"
import FontSize from "@tiptap/extension-font-size"
import TextStyle from "@tiptap/extension-text-style"
import { jsPDF } from "jspdf"
import html2canvas from "html2canvas"
import BalanceIcon from "@mui/icons-material/Balance"
import { motion } from "framer-motion"
// First, add the docx library import at the top with other imports
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx"

const saveAs = (blob: Blob, fileName: string) => {
  const link = document.createElement("a")
  link.href = window.URL.createObjectURL(blob)
  link.download = fileName
  link.click()
}

// Complete replacement of the HTMLtoDOCX function with improved font size handling
// Replace the entire HTMLtoDOCX function with this improved version
// Replace the entire HTMLtoDOCX function with this improved version

const HTMLtoDOCX = async (html: string, _: any, options: any) => {
  try {
    // Create a new document
    const doc = new Document({
      sections: [],
    })

    // Parse the HTML content
    const parser = new DOMParser()
    const htmlDoc = parser.parseFromString(html, "text/html")

    // Process each element in the HTML body
    const elements = htmlDoc.body.children
    const docElements: any[] = []

    // Helper function to extract font size from elements
    function extractFontSize(element: Element): number | undefined {
      // Try to get font size from style attribute
      if (element.style && element.style.fontSize) {
        const size = element.style.fontSize

        // Handle pt values
        if (size.endsWith("pt")) {
          return Number.parseFloat(size) * 2 // DOCX uses half-points
        }

        // Handle px values
        if (size.endsWith("px")) {
          return Math.round(Number.parseFloat(size) * 0.75 * 2) // px to pt to half-points
        }

        // Handle direct values
        const numSize = Number.parseFloat(size)
        if (!isNaN(numSize)) {
          return numSize * 2 // Assume pt and convert to half-points
        }
      }

      // Look for fontSize in dataset (some editors store it here)
      if (element.dataset && element.dataset.fontSize) {
        const size = Number.parseInt(element.dataset.fontSize, 10)
        if (!isNaN(size)) {
          return size * 2 // Convert to half-points
        }
      }

      // Check for specific class patterns
      if (element.className) {
        // Try to find font-size classes (varies by editor)
        const sizeMatch = element.className.match(/text-(\d+)|font-size-(\d+)|fs-(\d+)/)
        if (sizeMatch) {
          // Use the first matched group that has a value
          const size = Number.parseInt(sizeMatch[1] || sizeMatch[2] || sizeMatch[3], 10)
          if (!isNaN(size)) {
            return size * 2 // Convert to half-points
          }
        }
      }

      return undefined // Let parent element or default handle it
    }

    // Helper function to create a paragraph with proper formatting
    const createParagraph = (options: any = {}) => {
      return new Paragraph({
        ...options,
        spacing: {
          before: 200,
          after: 200,
        },
      })
    }

    // Process each element
    Array.from(elements).forEach((element) => {
      const tagName = element.tagName.toLowerCase()
      const textContent = element.textContent || ""

      switch (tagName) {
        case "p": {
          // Process paragraph
          let alignment = AlignmentType.LEFT
          if (element.style.textAlign === "center") alignment = AlignmentType.CENTER
          if (element.style.textAlign === "right") alignment = AlignmentType.RIGHT
          if (element.style.textAlign === "justify") alignment = AlignmentType.JUSTIFIED

          // Create a new paragraph
          const paragraph = createParagraph({ alignment })

          // Process the content of the paragraph to handle formatting
          processNodeWithFormatting(element, paragraph)

          docElements.push(paragraph)
          break
        }

        case "h1": {
          const paragraph = createParagraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          })
          processNodeWithFormatting(element, paragraph)
          docElements.push(paragraph)
          break
        }

        case "h2": {
          const paragraph = createParagraph({
            heading: HeadingLevel.HEADING_2,
          })
          processNodeWithFormatting(element, paragraph)
          docElements.push(paragraph)
          break
        }

        case "ul":
          // Process unordered list
          Array.from(element.children).forEach((li) => {
            const paragraph = createParagraph({
              indent: { left: 720 }, // 0.5 inch
            })

            // Add bullet point
            paragraph.addChildElement(
              new TextRun({
                text: "• ",
                bold: false,
                size: extractFontSize(li), // Attempt to get font size from list item
              }),
            )

            // Process the content of the list item
            processNodeWithFormatting(li, paragraph)

            docElements.push(paragraph)
          })
          break

        case "ol":
          // Process ordered list
          Array.from(element.children).forEach((li, index) => {
            const paragraph = createParagraph({
              indent: { left: 720 }, // 0.5 inch
            })

            // Add number
            paragraph.addChildElement(
              new TextRun({
                text: `${index + 1}. `,
                bold: false,
                size: extractFontSize(li), // Attempt to get font size from list item
              }),
            )

            // Process the content of the list item
            processNodeWithFormatting(li, paragraph)

            docElements.push(paragraph)
          })
          break

        default:
          // Default paragraph for other elements
          const paragraph = createParagraph()
          processNodeWithFormatting(element, paragraph)
          docElements.push(paragraph)
      }
    })

    // Function to process a node and its children with proper formatting
    function processNodeWithFormatting(node: Node, paragraph: any) {
      if (node.nodeType === Node.TEXT_NODE) {
        // Text node - add as a simple text run
        if (node.textContent && node.textContent.trim()) {
          paragraph.addChildElement(
            new TextRun({
              text: node.textContent,
            }),
          )
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element
        const tagName = element.tagName.toLowerCase()

        // Get font size for this element
        const elementFontSize = extractFontSize(element)

        // Handle different formatting tags
        if (tagName === "strong" || tagName === "b") {
          // Bold text
          if (element.textContent) {
            paragraph.addChildElement(
              new TextRun({
                text: element.textContent,
                bold: true,
                size: elementFontSize,
              }),
            )
          }
        } else if (tagName === "em" || tagName === "i") {
          // Italic text
          if (element.textContent) {
            paragraph.addChildElement(
              new TextRun({
                text: element.textContent,
                italics: true,
                size: elementFontSize,
              }),
            )
          }
        } else if (tagName === "u") {
          // Underlined text
          if (element.textContent) {
            paragraph.addChildElement(
              new TextRun({
                text: element.textContent,
                underline: {},
                size: elementFontSize,
              }),
            )
          }
        } else if (tagName === "span") {
          // Special handling for span elements which often contain styling
          if (element.childNodes.length === 0 && element.textContent) {
            // Direct text content in span
            paragraph.addChildElement(
              new TextRun({
                text: element.textContent,
                size: elementFontSize,
              }),
            )
          } else {
            // Process children
            Array.from(element.childNodes).forEach((child) => {
              if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
                // Apply parent's font size to text nodes
                paragraph.addChildElement(
                  new TextRun({
                    text: child.textContent,
                    size: elementFontSize,
                  }),
                )
              } else {
                processNodeWithFormatting(child, paragraph)
              }
            })
          }
        } else if (tagName === "div" || tagName === "p") {
          // Process children of container elements
          Array.from(element.childNodes).forEach((child) => {
            processNodeWithFormatting(child, paragraph)
          })
        } else {
          // For other elements, just add the text content
          if (element.textContent) {
            paragraph.addChildElement(
              new TextRun({
                text: element.textContent,
                size: elementFontSize,
              }),
            )
          }
        }
      }
    }

    // Add all elements to the document
    doc.addSection({
      properties: {},
      children: docElements,
    })

    // Generate the document as a blob
    return await Packer.toBlob(doc)
  } catch (error) {
    console.error("Error generating DOCX:", error)
    // Create a simple document with error message as fallback
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "Error generating document. Please try again or use a different format.",
                  bold: true,
                  color: "FF0000", // Red color
                }),
              ],
            }),
            new Paragraph({
              text: "The original content is included below:",
            }),
            new Paragraph({
              text: html.replace(/<[^>]*>/g, " ").substring(0, 1000), // Strip HTML tags and limit length
            }),
          ],
        },
      ],
    })

    return await Packer.toBlob(doc)
  }
}

// Helper function to determine text alignment
const getAlignment = (element: Element): AlignmentType => {
  const style = element.getAttribute("style") || ""
  const className = element.className || ""

  if (style.includes("text-align: center") || className.includes("text-center")) {
    return AlignmentType.CENTER
  } else if (style.includes("text-align: right") || className.includes("text-right")) {
    return AlignmentType.RIGHT
  } else if (style.includes("text-align: justify") || className.includes("text-justify")) {
    return AlignmentType.JUSTIFIED
  }

  return AlignmentType.LEFT
}

// Add a new function to convert HTML to Markdown near the other utility functions
const htmlToMarkdown = (html: string): string => {
  // Create a temporary div to parse the HTML
  const tempDiv = document.createElement("div")
  tempDiv.innerHTML = html

  // Helper function to process a node and its children
  const processNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || ""
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement
      const tagName = element.tagName.toLowerCase()
      const children = Array.from(element.childNodes).map(processNode).join("")

      switch (tagName) {
        case "h1":
          return `# ${children}\n\n`
        case "h2":
          return `## ${children}\n\n`
        case "h3":
          return `### ${children}\n\n`
        case "h4":
          return `#### ${children}\n\n`
        case "h5":
          return `##### ${children}\n\n`
        case "h6":
          return `###### ${children}\n\n`
        case "p":
          return `${children}\n\n`
        case "strong":
        case "b":
          return `**${children}**`
        case "em":
        case "i":
          return `*${children}*`
        case "u":
          return `<u>${children}</u>`
        case "code":
          return `\`${children}\``
        case "pre":
          return `\`\`\`\n${children}\n\`\`\`\n\n`
        case "ol":
          return (
            Array.from(element.children)
              .map((li, index) => `${index + 1}. ${processNode(li)}`)
              .join("\n") + "\n\n"
          )
        case "ul":
          return (
            Array.from(element.children)
              .map((li) => `- ${processNode(li)}`)
              .join("\n") + "\n\n"
          )
        case "li":
          // For list items, we just process the content
          return children
        case "br":
          return "\n"
        case "div":
          // For divs, we process children and add a newline
          return `${children}\n`
        default:
          return children
      }
    }

    return ""
  }

  // Process the entire document
  let markdown = ""
  Array.from(tempDiv.childNodes).forEach((node) => {
    markdown += processNode(node)
  })

  // Clean up extra newlines
  markdown = markdown.replace(/\n{3,}/g, "\n\n")

  return markdown
}

const editorStyles = `
  .ProseMirror {
    font-family: "Calibri", sans-serif;
    font-size: 14px;
    line-height: 1.6;
    min-height: 100%;
    padding: 1rem;
    color: #1a1a1a;
    outline: none;
  }
  
  .ProseMirror p {
    margin: 0;
    min-height: 24px;
    line-height: 24px;
    margin-bottom: 1em;
  }

  .ProseMirror > :first-child {
    margin-top: 0;
  }

  .ProseMirror > :last-child {
    margin-bottom: 0;
  }

  .ProseMirror h1 {
    font-size: 1.5em;
    font-weight: bold;
    margin: 1.5em 0 0.5em;
    text-align: center;
  }

  .ProseMirror h2 {
    font-size: 1.25em;
    font-weight: bold;
    margin: 1em 0 0.5em;
  }

  .ProseMirror strong {
    font-weight: 600;
  }

  .ProseMirror ul, .ProseMirror ol {
    padding-left: 1.5em;
    margin: 0.5em 0;
  }

  .ProseMirror li {
    margin: 0.25em 0;
  }

  .ProseMirror li p {
    margin: 0;
  }

  .ProseMirror br {
    display: block;
    content: "";
    margin-top: 0.5em;
  }
`

const genAI = new GoogleGenerativeAI("AIzaSyAqJm2rKndj-4M9ZyME0PrWGuJsxWrUzyE")

// Inline ForkIcon component
const ForkIcon: React.FC = () => {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 3v12" />
      <path d="M17 21v-6" />
      <path d="M7 15c0 2.21 1.79 4 4 4h6" />
      <path d="M7 3c0 2.21 1.79 4 4 4h6" />
      <path d="M17 15c0 2.21-1.79 4-4 4" />
      <path d="M17 3c0 2.21-1.79 4-4 4" />
    </svg>
  )
}

interface StreamingTextProps {
  text: string
  isComplete: boolean
  onComplete: () => void
}

const StreamingText: React.FC<StreamingTextProps> = ({ text, isComplete, onComplete }) => {
  const [displayedText, setDisplayedText] = useState("")
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Calculate the delay based on text length to make it take 4-5 seconds
  const getCharDelay = () => {
    const targetDuration = 4500 // 4.5 seconds
    return Math.max(10, Math.min(50, targetDuration / text.length))
  }

  useEffect(() => {
    if (isComplete) {
      setDisplayedText(text)
      onComplete()
      return
    }

    if (currentIndex < text.length && !isPaused) {
      const delay = getCharDelay()
      const timeout = setTimeout(
        () => {
          setDisplayedText((prev) => prev + text[currentIndex])
          setCurrentIndex((prev) => prev + 1)

          // Simulate natural typing with occasional pauses
          if (text[currentIndex] === "." || text[currentIndex] === "," || text[currentIndex] === ":") {
            setIsPaused(true)
            setTimeout(() => setIsPaused(false), 150)
          }

          if (currentIndex === text.length - 1) {
            onComplete()
          }
        },
        isPaused ? 0 : delay,
      )

      return () => clearTimeout(timeout)
    }
  }, [currentIndex, text, isComplete, isPaused, onComplete])

  // Auto-scroll as text is generated
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [displayedText])

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      <ReactMarkdown className="prose prose-sm max-w-none dark:prose-invert text-black">
        {displayedText || " "}
      </ReactMarkdown>

      {!isComplete && currentIndex < text.length && (
        <div className="inline-flex items-center mt-1">
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              repeat: Number.POSITIVE_INFINITY,
              duration: 1.5,
            }}
            className="mr-2"
          >
            <Scale className="h-4 w-4 text-purple-600" />
          </motion.div>
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.5 }}
            className="text-purple-600 text-sm font-medium"
          >
            Generating legal response...
          </motion.span>
        </div>
      )}
    </div>
  )
}

interface SpinnerProps {
  legalDomain?: string
  mode: "research" | "draft" | "chatbot" | "context"
  stage: "consulting" | "processing"
  text?: string
}

const Spinner: React.FC<SpinnerProps> = ({ legalDomain, mode, stage, text }) => {
  return (
    <div className="space-y-2">
      <div className="flex justify-start items-center" role="status">
        <motion.div
          animate={{
            rotate: 360,
            borderColor: ["#7c3aed", "#9f7aea", "#7c3aed"],
          }}
          transition={{
            repeat: Number.POSITIVE_INFINITY,
            duration: 1.5,
            ease: "linear",
          }}
          className="rounded-full h-5 w-5 border-2 border-t-transparent mr-2"
          aria-hidden="true"
        />
        <div className="flex items-center">
          {stage === "consulting" && (
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.5 }}
              className="mr-2"
            >
              <Scale className="h-4 w-4 text-purple-600" />
            </motion.div>
          )}
          <motion.span
            animate={{
              color: ["#1f2937", "#9ca3af", "#1f2937"],
              fontWeight: [400, 600, 400],
            }}
            transition={{
              repeat: Number.POSITIVE_INFINITY,
              duration: 2,
              ease: "easeInOut",
            }}
            className="text-sm"
          >
            {text ||
              (stage === "consulting"
                ? `Consulting ${legalDomain || "Legal"} agent...`
                : mode === "research"
                  ? "Researching legal precedents..."
                  : mode === "draft"
                    ? "Drafting legal document..."
                    : mode === "context"
                      ? "Processing legal context..."
                      : "Processing...")}
          </motion.span>
        </div>
      </div>
    </div>
  )
}

interface Message {
  id: string
  text: string
  sender: "user" | "ai"
  timestamp: Date
  summary?: string
  file?: {
    name: string
    size: number
    type: string
  }
}

interface Chat {
  id: string
  name: string
  messages: Message[]
  favorite: boolean
  type: ChatType
  contextFiles?: File[]
}

interface Case {
  id: string
  name: string
  chats: Chat[]
  favorite: boolean
}

type Mode = "research" | "draft" | "chatbot" | "context"

type ChatType = "chat" | "research" | "draft" | "context"

interface ModeHistory {
  cases: Case[]
  selectedCase: string | null
  selectedChat: string | null
}

const LegalThinkAI: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [consultingAgent, setConsultingAgent] = useState("")
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [currentMode, setCurrentMode] = useState<Mode>("chatbot")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const [processingStage, setProcessingStage] = useState<"consulting" | "processing">("consulting")
  const [editorContent, setEditorContent] = useState<string>("")
  const [showEditor, setShowEditor] = useState(false)
  const [latestDraftResponse, setLatestDraftResponse] = useState<string>("")
  const [draftVersions, setDraftVersions] = useState<Array<{ content: string; history: string[]; future: string[] }>>(
    [],
  )
  const [currentVersionIndex, setCurrentVersionIndex] = useState(-1)
  const [editorState, setEditorState] = useState({
    isBold: false,
    isItalic: false,
    isUnderline: false,
    font: "sans-serif",
    fontSize: "14px",
  })

  const [history, setHistory] = useState<ModeHistory>({
    cases: [],
    selectedCase: null,
    selectedChat: null,
  })

  const [expandedCases, setExpandedCases] = useState<Record<string, boolean>>({})
  const [renameItem, setRenameItem] = useState<{
    id: string
    type: "case" | "chat" | "research" | "draft" | "context"
    name: string
  } | null>(null)

  const [fileViewerModal, setFileViewerModal] = useState<{
    open: boolean
    content: string | null
    type: string
  }>({ open: false, content: null, type: "" })

  const chatMsg = `Okay, based on the detailed scenario, **Mr. X, a police inspector, could be tried under multiple legal provisions in India for his caste-based discrimination and misconduct.**

**Laws Mr. X Could Be Tried Under:**

1. **Article 17 of the Indian Constitution** – Abolishes untouchability and forbids its practice in any form, and any attempt to enforce untouchability is a violation of this constitutional mandate.
   - In Mr. X's case, his derogatory remarks about people from Scheduled Castes and his refusal to register complaints from them could be seen as direct violations of Article 17. The caste-based comments and actions could be considered as 'untouchability' practices, leading to charges for promoting such discrimination.

2. **The Protection of Civil Rights Act, 1955** – Criminalizes the enforcement of disabilities arising out of untouchability, punishing those who forcefully impose social or economic restrictions on individuals based on their caste.
   - Mr. X's refusal to provide assistance to individuals from lower-caste communities and dismissing their complaints based on caste could be prosecuted under this Act. His actions undermine the legal rights of these individuals, and such discrimination violates the provisions of the Act.

3. **The Scheduled Castes and the Scheduled Tribes (Prevention of Atrocities) Act, 1989** – Provides strict punishment for atrocities committed against SC/ST individuals, including discrimination, harassment, and acts of violence.
   - Mr. X's threat to the Scheduled Caste woman and his physical and verbal abuse of Dalit youths could constitute a violation of this Act. His actions directly target the dignity and legal rights of SC/ST individuals, including abuse and harassment, both verbal and physical.

4. **Indian Penal Code (IPC):**

   - **Section 166** – Public servant disobeying law with intent to cause injury.
     - If Mr. X intentionally violated laws by dismissing complaints or acting with caste bias, he could be charged under Section 166. His actions of not registering complaints or providing assistance based on caste would be an act of misconduct by a public servant.

   - **Section 323** – Punishment for voluntarily causing hurt.
     - If Mr. X is found to have physically harmed the Dalit youths or the woman, charges under Section 323 could apply, especially if any harm was inflicted during the interactions.

   - **Section 506** – Criminal intimidation.
     - Mr. X's threats to the woman about her family being targeted and his verbal abuse could lead to charges under Section 506, as his actions involved criminal intimidation, coercion, and threats.

   - **Section 341** – Punishment for wrongful restraint.
     - Mr. X's act of preventing the Dalit youths from contacting legal aid or their family members could be categorized under wrongful restraint, especially if he actively restricted their freedom of movement or access to help.

5. **The Prison Act, 1894** (if discrimination happens inside a prison) – Governs the treatment of prisoners, and caste-based discrimination violates the Act's principles of non-discrimination and humane treatment.

**Relevant Cases Related to Article 17 & Caste Discrimination:**

1. **Sukanya Shantha v. Union of India (2024)** – The Supreme Court struck down discriminatory prison rules and ordered amendments to prison manuals to remove caste-based labor segregation, emphasizing the importance of equal treatment for all prisoners.

2. **State of Karnataka v. Appa Balu Ingale (1993)** – The Supreme Court emphasized the strict enforcement of Article 17 to prevent caste-based discrimination and its detrimental impact on social equality.

3. **People's Union for Democratic Rights v. Union of India (1982)** – The Supreme Court held that the state is responsible for preventing untouchability and caste-based discrimination, even in private employment, reinforcing the state's duty to uphold constitutional rights.

4. **Devarajiah v. B. Padmana (1958)** – The Madras High Court ruled that untouchability includes social disabilities imposed based on caste and clarified its broad scope, setting a precedent for addressing such violations.

**In conclusion, Mr. X's actions, including making derogatory remarks, refusing to register complaints, physically intimidating victims, and preventing them from accessing legal aid, would lead to legal consequences under the aforementioned laws. These practices, which target individuals based on caste, are violations of constitutional and statutory rights and cannot be tolerated under Indian law.**`

  const researchMsg = `The Places of Worship (Special Provisions) Act, 1991, prohibits the conversion of any place of worship and mandates the maintenance of its religious character as it existed on August 15, 1947. Recently, under the leadership of Chief Justice of India (CJI) Sanjiv Khanna, the Supreme Court has taken significant steps regarding this Act.

**Formation of Special Bench:**

On December 7, 2024, the Supreme Court constituted a special bench headed by CJI Sanjiv Khanna to hear public interest litigations (PILs) challenging the validity of certain provisions of the 1991 Act. The bench includes Justices Sanjay Kumar and K.V. Viswanathan. The petitions question the constitutionality of sections 2, 3, and 4 of the Act, which prohibit filing lawsuits to reclaim a place of worship or seek a change in its character from what prevailed on August 15, 1947. The bench is expected to hear the matter on December 12, 2024.

**Restriction on New Suits and Surveys:**

On December 12, 2024, the Supreme Court issued an order restricting courts from registering new suits related to the Places of Worship Act and directed that no surveys or effective interim orders be conducted in pending cases until the Court concludes its hearing on the matter. The Court emphasized that no fresh suits shall be registered, and no effective interim orders, including surveys, shall be passed in existing cases, until the Court concludes its examination of the Act's validity.`

  const draftMsg = `**The Service Contract between X Company and Employee is made on this January 31, 2025, between X Company (hereinafter referred to as 'the Employer'), with its registered office located at 1234 Corporate Avenue, City, Country, and John Doe (hereinafter referred to as 'the Employee'), residing at 5678 Residential Street, City, Country.**

1. Position and Duties
- The Employer agrees to employ the Employee as Software Developer.
- The Employee agrees to perform the duties and responsibilities as outlined by the Employer and any additional tasks that may be assigned by the Employer during the course of employment.

2. Term of Employment
- The Employee's employment shall begin on February 1, 2025 and will continue until terminated by either party in accordance with the terms of this contract.

3. Bond Clause
- The Employee agrees to remain employed with the Employer for a minimum period of 2 years.
- Should the Employee voluntarily terminate their employment before the completion of this term, the Employee agrees to repay the Employer a sum of $10,000 as compensation for the training, resources, and other investments made by the Employer.

4. Salary and Benefits
- The Employer will provide the Employee with a salary of $80,000 per year, along with health insurance, annual bonuses, and retirement benefits.

5. Confidentiality
- The Employee agrees not to disclose or use any confidential information acquired during the course of their employment for personal or external purposes.

6. Termination
- Either party may terminate this agreement by providing 30 days notice, or payment in lieu of notice, unless the termination is for cause.

7. Governing Law
- This contract will be governed by and construed in accordance with the laws of [Country].

Signed:

John Doe
Date: January 31, 2025

Signed:

Jane Smith, HR Manager
Date: January 31, 2025`

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
        bulletList: true,
        orderedList: true,
        bold: {
          HTMLAttributes: {
            class: "font-bold",
          },
        },
        paragraph: {
          HTMLAttributes: {
            class: "mb-4",
          },
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        defaultAlignment: "left",
        alignments: ["left", "center", "right", "justify"],
        keepMarks: true,
        extendEmptyMarkRange: true,
      }),
      TextStyle,
      FontSize.configure({
        types: ["textStyle"],
      }),
      Underline, // Add the Underline extension here
    ],
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[500px] p-4",
      },
      transformPastedText(text) {
        // Safety check - if text is undefined or null, return empty string
        if (!text) return ""

        try {
          // Convert markdown-style formatting to HTML
          text = text.replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>")
          text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
          text = text.replace(/\*(.*?)\*/g, "<em>$1</em>")
          text = text.replace(/~~(.*?)~~/g, "<s>$1</s>")
          text = text.replace(/`(.*?)`/g, "<code>$1</code>")

          // Handle headings
          text = text.replace(/^#{6}\s+(.*)$/gm, "<h6>$1</h6>")
          text = text.replace(/^#{5}\s+(.*)$/gm, "<h5>$1</h5>")
          text = text.replace(/^#{4}\s+(.*)$/gm, "<h4>$1</h4>")
          text = text.replace(/^#{3}\s+(.*)$/gm, "<h3>$1</h3>")
          text = text.replace(/^#{2}\s+(.*)$/gm, "<h2>$1</h2>")
          text = text.replace(/^#{1}\s+(.*)$/gm, "<h1>$1</h1>")

          // Handle lists
          text = text.replace(/^\d+\.\s+(.*)$/gm, "<ol><li>$1</li></ol>")
          text = text.replace(/^-\s+(.*)$/gm, "<ul><li>$1</li></ul>")

          // Ensure each point is on a new line
          text = text.replace(/(\d+\.|-)\s/g, "<p>$1 ")

          // Convert double line breaks to paragraph tags
          text = text.replace(/\n\n/g, "</p><p>")

          // Wrap the entire text in paragraph tags if not already wrapped
          if (!text.startsWith("<p>")) {
            text = `<p>${text}</p>`
          }

          return text
        } catch (error) {
          console.error("Error transforming pasted text:", error)
          return text // Return original text if transformation fails
        }
      },
    },
    content: editorContent,
    onUpdate: ({ editor }) => {
      const newContent = editor.getHTML()
      if (newContent !== editorContent) {
        setEditorContent(newContent)

        // Save to draft versions
        setDraftVersions((prev) => {
          const updatedVersions = [...prev]
          if (updatedVersions[currentVersionIndex]) {
            updatedVersions[currentVersionIndex] = {
              ...updatedVersions[currentVersionIndex],
              content: newContent,
              history: [...updatedVersions[currentVersionIndex].history, newContent],
              future: [],
            }
          }
          return updatedVersions
        })

        // Also save to the specific draft chat
        if (history.selectedChat) {
          setDraftContents((prev) => ({
            ...prev,
            [history.selectedChat!]: newContent,
          }))
        }
      }
    },
  })

  const processAIContent = (content: string) => {
    // Convert markdown-style bold to HTML bold
    content = content.replace(/\*\*\*(.*?)\*\*\*/g, "<strong>$1</strong>")
    content = content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    // Ensure each point is on a new line
    content = content.replace(/(\d+\.|-)\s/g, "<p>$1 ")
    // Convert double line breaks to paragraph tags
    content = content.replace(/\n\n/g, "</p><p>")
    // Wrap the entire text in paragraph tags
    content = `<p>${content}</p>`
    return content
  }

  useEffect(() => {
    initializeHistories()
  }, [])

  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      const currentCursor = editor.state.selection.$head.pos
      editor.commands.setContent(editorContent, false)
      editor.commands.setTextSelection(currentCursor)
    }
  }, [editorContent, editor])

  useEffect(() => {
    if (editor) {
      editor.on("paste", (view, event) => {
        // Check if event and clipboardData exist before proceeding
        if (event && event.clipboardData && event.clipboardData.getData) {
          try {
            const text = event.clipboardData.getData("text")
            if (text) {
              // Convert markdown to HTML
              const formattedText = text
                .replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>")
                .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                .replace(/\*(.*?)\*/g, "<em>$1</em>")
                .replace(/~~(.*?)~~/g, "<s>$1</s>")
                .replace(/`(.*?)`/g, "<code>$1</code>")
                .replace(/^#{6}\s+(.*)$/gm, "<h6>$1</h6>")
                .replace(/^#{5}\s+(.*)$/gm, "<h5>$1</h5>")
                .replace(/^#{4}\s+(.*)$/gm, "<h4>$1</h4>")
                .replace(/^#{3}\s+(.*)$/gm, "<h3>$1</h3>")
                .replace(/^#{2}\s+(.*)$/gm, "<h2>$1</h2>")
                .replace(/^#{1}\s+(.*)$/gm, "<h1>$1</h1>")
                .replace(/^\d+\.\s+(.*)$/gm, "<ol><li>$1</li></ol>")
                .replace(/^-\s+(.*)$/gm, "<ul><li>$1</li></ul")
                .replace(/\n\n/g, "</p><p>")

              // Insert the formatted content
              editor.commands.insertContent(formattedText)
              event.preventDefault()
            }
          } catch (error) {
            console.error("Error processing pasted content:", error)
            // Let ProseMirror handle the paste if our processing fails
          }
        }
        // If we don't have clipboardData, let the default handler take over
      })
    }

    return () => {
      // Clean up the event listener when the component unmounts
      if (editor) {
        editor.off("paste")
      }
    }
  }, [editor])

  const initializeHistories = () => {
    const initialCases: Case[] = [
      {
        id: "case-1",
        name: "Case #1",
        chats: [
          {
            id: "case-1-1",
            name: "Initial Consultation",
            messages: [],
            favorite: false,
            type: "chat",
          },
        ],
        favorite: false,
      },
    ]

    setHistory({
      cases: initialCases,
      selectedCase: initialCases[0].id,
      selectedChat: initialCases[0].chats[0].id,
    })
  }

  const getCurrentHistory = () => history

  const summarizeDraft = async (draft: string, previousDrafts: string[], userInput: string) => {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" })
    const chatSession = model.startChat()

    let prompt = `The user requested: "${userInput}"

Read the following draft:

${draft}

`

    if (previousDrafts.length > 0) {
      prompt += `Compare this draft to the previous drafts and summarize the changes. `
      prompt += `Previous drafts:
${previousDrafts.join("\n\n")}

`
    } else {
      prompt += `Summarize the content of this draft. `
    }

    prompt += `Respond in this format: 'I have generated the draft you asked for. Here's a summary:
• [First point]
• [Second point]
• [Third point]
...'`

    const result = await chatSession.sendMessage(prompt)
    return result.response.text()
  }

  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  // Add a new state variable to store draft-specific content
  const [draftContents, setDraftContents] = useState<Record<string, string>>({})

  // Add these new state variables near the top of the component, with other state variables
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false)
  const [downloadDetails, setDownloadDetails] = useState<{
    format: "docx" | "pdf" | "txt"
    fileName: string
  } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const history = getCurrentHistory()
    if (!history.selectedCase || !history.selectedChat) return

    if (inputValue.trim() || uploadedFile) {
      const newMessage: Message = {
        id: Math.random().toString(),
        text: inputValue,
        sender: "user",
        timestamp: new Date(),
        file: uploadedFile
          ? {
              name: uploadedFile.name,
              size: uploadedFile.size,
              type: uploadedFile.type,
            }
          : undefined,
      }

      const updatedHistory = {
        ...history,
        cases: history.cases.map((case_) => {
          if (case_.id === history.selectedCase) {
            return {
              ...case_,
              chats: case_.chats.map((chat) => {
                if (chat.id === history.selectedChat) {
                  return {
                    ...chat,
                    messages: [...chat.messages, newMessage],
                  }
                }
                return chat
              }),
            }
          }
          return case_
        }),
      }

      // Update the history with the user's message
      setHistory(updatedHistory)
      setInputValue("")

      // Scroll to bottom immediately after user sends a message
      setTimeout(scrollToBottom, 100)

      // Start AI processing
      setIsLoading(true)
      setProcessingStage("consulting")

      try {
        const currentCase = updatedHistory.cases.find((c) => c.id === updatedHistory.selectedCase)
        const currentChat = currentCase?.chats.find((chat) => chat.id === updatedHistory.selectedChat)

        const formData = new FormData()
        // If in draft mode and there's editor content, append it to the input
        let messageToSend = inputValue
        if (currentMode === "draft" && editor) {
          const currentDraftContent = editor.getHTML()
          if (currentDraftContent && currentDraftContent.trim() !== "") {
            messageToSend = `${inputValue}\n\n__DRAFT_CONTENT__\n${currentDraftContent}`
          }
        }
        formData.append("message", messageToSend)
        formData.append("mode", currentMode)
        formData.append("history", JSON.stringify(currentChat?.messages || []))
        if (uploadedFile) {
          formData.append("file", uploadedFile)
        }

        const response = await axios.post("/api/chat", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        })

        if (response.data && response.data.domain) {
          setConsultingAgent(response.data.domain)
          console.log("Consulting agent set to:", response.data.domain)
        } else {
          const model2 = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" })
          const domainResponse = await model2.generateContent(
            `Classify this legal query: '${inputValue}'. Choose from: Criminal Law, Civil Law, ` +
              `Constitutional Law, Corporate Law, Intellectual Property Law, Environmental Law, ` +
              `International Law, Tax Law, Family Law, Cyber Law. If more than one domain is involved, you may choose them and use commas, e.g., ` +
              `Civil Law, Environmental Law, etc. **Output only the chosen domain**.`,
          )
          const generatedDomain = domainResponse.response.text().trim()
          setConsultingAgent(generatedDomain)
          console.log("Consulting agent set to (generated):", generatedDomain)
        }

        // Add a delay to simulate the consulting stage
        await new Promise((resolve) => setTimeout(resolve, 2000))

        setProcessingStage("processing")

        // Add a delay to simulate the processing stage
        await new Promise((resolve) => setTimeout(resolve, 2000))

        if (response.data) {
          let aiResponse = response.data.response

          // Handle undefined AI response
          if (aiResponse === undefined) {
            switch (currentMode) {
              case "research":
                aiResponse = researchMsg
                break
              case "draft":
                aiResponse = draftMsg
                break
              default:
                aiResponse = chatMsg
            }
          }

          // Customize the response based on the current mode
          if (currentMode === "draft") {
            const processedContent = processAIContent(aiResponse)

            // Create a new draft version
            const newDraft = {
              content: processedContent,
              history: [processedContent],
              future: [],
            }

            // Add the new draft to versions
            setDraftVersions((prev) => [...prev, newDraft])
            setCurrentVersionIndex((prev) => prev + 1)

            // Set the editor content to the new draft
            setEditorContent(processedContent)

            // Save this content specifically for this chat ID
            if (history.selectedChat) {
              setDraftContents((prev) => ({
                ...prev,
                [history.selectedChat]: processedContent,
              }))
            }

            // Show the editor
            setShowEditor(true)
            setIsSidebarCollapsed(true) // Auto-collapse sidebar when editor is opened

            // Get previous drafts for summarization
            const previousDrafts = draftVersions.map((version) => version.content)

            // Summarize the draft using Gemini AI, passing previous drafts and user input
            const summary = await summarizeDraft(aiResponse, previousDrafts, inputValue)
            aiResponse = summary
          } else {
            aiResponse = `\n\n${aiResponse}` // Modification here
          }

          const messageId = Math.random().toString()
          setStreamingMessageId(messageId)

          const aiMessage: Message = {
            id: messageId,
            text: aiResponse,
            sender: "ai",
            timestamp: new Date(),
            summary: currentMode === "draft" ? aiResponse : undefined,
          }

          // Inside handleSubmit function, replace the setHistory update for the AI message with:
          setHistory((prev) => ({
            ...prev,
            cases: prev.cases.map((case_) => {
              if (case_.id === prev.selectedCase) {
                return {
                  ...case_,
                  chats: case_.chats.map((chat) => {
                    if (chat.id === prev.selectedChat) {
                      return {
                        ...chat,
                        messages: [...chat.messages, aiMessage],
                      }
                    }
                    return chat
                  }),
                }
              }
              return case_
            }),
          }))

          // Keep loading state true while streaming
          setIsLoading(true)
          setTimeout(() => {
            setStreamingMessageId(null)
            setIsLoading(false)
          }, 5000) // Ensure streaming takes about 5 seconds
        }
      } catch (error) {
        console.error("Error:", error)
        const errorMessage: Message = {
          id: Math.random().toString(),
          text: `Sorry, an error occurred: ${error instanceof Error ? error.message : "Unknown error"}`,
          sender: "ai",
          timestamp: new Date(),
        }

        setHistory((prev) => ({
          ...prev,
          cases: prev.cases.map((case_) => {
            if (case_.id === prev.selectedCase) {
              return {
                ...case_,
                chats: case_.chats.map((chat) => {
                  if (chat.id === prev.selectedChat) {
                    return {
                      ...chat,
                      messages: [...chat.messages, errorMessage],
                    }
                  }
                  return chat
                }),
              }
            }
            return case_
          }),
        }))
      } finally {
        setIsLoading(false)
        setConsultingAgent("")
        setUploadedFile(null)
        setProcessingStage("consulting")
      }
    }
  }

  const toggleCase = (caseId: string) => {
    setExpandedCases((prev) => {
      // Check if the case is already expanded
      const isCurrentlyExpanded = prev[caseId]

      // Create a new object with all cases collapsed
      const allCollapsed = Object.keys(prev).reduce(
        (acc, key) => {
          acc[key] = false
          return acc
        },
        {} as Record<string, boolean>,
      )

      // If the case was not expanded, expand it; otherwise, leave it collapsed
      return {
        ...allCollapsed,
        [caseId]: !isCurrentlyExpanded,
      }
    })
  }

  // Find the selectCase function and replace it with this version that moves cases to the top only when deselected
  const selectCase = (caseId: string) => {
    setHistory((prev) => {
      // Check if this is a deselection (clicking on the currently selected case)
      const isDeselection = prev.selectedCase === caseId

      if (isDeselection) {
        // If deselecting, move the case to the top of the list
        const selectedCase = prev.cases.find((c) => c.id === caseId)
        if (!selectedCase) return prev

        const updatedCases = prev.cases.filter((c) => c.id !== caseId)
        return {
          ...prev,
          cases: [selectedCase, ...updatedCases],
          selectedCase: caseId,
          selectedChat: null,
        }
      } else {
        // If selecting a new case, don't reorder
        return {
          ...prev,
          selectedCase: caseId,
          selectedChat: null,
        }
      }
    })
  }

  // Modify the selectChat function to properly close the editor when switching chats
  const selectChat = (caseId: string, chatId: string) => {
    const selectedCase = history.cases.find((c) => c.id === caseId)
    const selectedChat = selectedCase?.chats.find((chat) => chat.id === chatId)

    // Always close the editor when switching chats
    setShowEditor(false)

    if (selectedChat) {
      // Set the mode based on the chat type
      if (selectedChat.name.toLowerCase().includes("research")) {
        setCurrentMode("research")
      } else if (selectedChat.name.toLowerCase().includes("draft")) {
        setCurrentMode("draft")

        // Reset draft state when switching to a different draft chat
        setDraftVersions([])
        setCurrentVersionIndex(-1)

        // If this draft chat has content, prepare it
        if (draftContents[chatId]) {
          setLatestDraftResponse(draftContents[chatId])
        } else {
          // Initialize with empty content if it's a new draft
          setLatestDraftResponse("")
          setDraftContents((prev) => ({
            ...prev,
            [chatId]: "",
          }))
        }
      } else if (selectedChat.name.toLowerCase().includes("context")) {
        setCurrentMode("context")
      } else {
        setCurrentMode("chatbot")
      }

      setHistory((prev) => ({
        ...prev,
        selectedCase: caseId,
        selectedChat: chatId,
      }))
    } else {
      // If the selected chat doesn't exist, clear the selection
      setHistory((prev) => ({
        ...prev,
        selectedCase: caseId,
        selectedChat: null,
      }))
    }
  }

  const createNewChat = (caseId: string, chatType: ChatType = "chat") => {
    const existingChats =
      history.cases.find((c) => c.id === caseId)?.chats.filter((chat) => chat.type === chatType) || []
    const chatNumber = existingChats.length + 1
    const newChat: Chat = {
      id: `${caseId}-${chatType}-${Date.now()}`,
      name: `${chatType.charAt(0).toUpperCase() + chatType.slice(1)} ${chatNumber}`,
      messages: [],
      favorite: false,
      type: chatType,
    }

    setHistory((prev) => ({
      ...prev,
      cases: prev.cases.map((c) => {
        if (c.id === caseId) {
          return {
            ...c,
            chats: [...c.chats, newChat],
          }
        }
        return c
      }),
      selectedChat: newChat.id,
    }))

    setExpandedCases((prev) => ({
      ...prev,
      [caseId]: true,
    }))

    switch (chatType) {
      case "research":
        setCurrentMode("research")
        break
      case "draft":
        setCurrentMode("draft")
        break
      case "context":
        setCurrentMode("context")
        break
      default:
        setCurrentMode("chatbot")
    }

    if (chatType === "draft") {
      // Initialize an empty draft content for this new chat
      setDraftContents((prev) => ({
        ...prev,
        [newChat.id]: "",
      }))

      // Reset draft versions when creating a new draft chat
      setDraftVersions([])
      setCurrentVersionIndex(-1)
      setLatestDraftResponse("")
      setEditorContent("")
    }
  }

  const createNewCase = async () => {
    const modePrefix = "Case"
    const modeId = "case"

    const modeCases = history.cases.filter((c) => c.id.startsWith(modeId))
    const newCaseNumber = modeCases.length + 1

    const newCase: Case = {
      id: `${modeId}-${newCaseNumber}`,
      name: `${modePrefix} #${newCaseNumber}`,
      chats: [],
      favorite: false,
    }

    setHistory((prev) => ({
      ...prev,
      // Add new case to the beginning of the array instead of the end
      cases: [newCase, ...prev.cases],
      selectedCase: newCase.id,
    }))

    switchMode("chatbot")
  }

  const forkCase = (caseToFork: Case, chatId?: string) => {
    const newCaseNumber = history.cases.filter((c) => c.name.startsWith(caseToFork.name)).length + 1
    let newCase: Case

    if (chatId) {
      const chatToFork = caseToFork.chats.find((chat) => chat.id === chatId)
      if (chatToFork) {
        newCase = {
          id: `${caseToFork.id}-fork-${newCaseNumber}`,
          name: `${caseToFork.name} (${newCaseNumber})`,
          chats: [{ ...chatToFork, id: `${chatToFork.id}-fork-1` }],
          favorite: false,
        }
      } else {
        return // Exit if chat not found
      }
    } else {
      newCase = {
        ...caseToFork,
        id: `${caseToFork.id}-fork-${newCaseNumber}`,
        name: `${caseToFork.name} (${newCaseNumber})`,
        favorite: false,
      }
    }

    setHistory((prev) => ({
      ...prev,
      // Add forked case to the beginning of the array
      cases: [newCase, ...prev.cases],
      selectedCase: newCase.id,
      selectedChat: chatId ? newCase.chats[0].id : null,
    }))
  }

  const createNewItem = async (caseId: string, itemType: ChatType) => {
    const targetCase = history.cases.find((c) => c.id === caseId)
    if (!targetCase) return

    const itemTypeCount = targetCase.chats.filter((chat) => chat.id.includes(`-${itemType}-`)).length
    const itemNumber = itemTypeCount + 1
    const newItem: Chat = {
      id: `${caseId}-${itemType}-${itemNumber}`,
      name: `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} ${itemNumber}`,
      messages: [],
      favorite: false,
      type: itemType,
    }

    setHistory((prev) => ({
      ...prev,
      cases: prev.cases.map((c) => {
        if (c.id === caseId) {
          return {
            ...c,
            chats: [...c.chats, newItem],
          }
        }
        return c
      }),
      selectedChat: newItem.id,
    }))

    return newItem
  }

  const clearChats = async () => {
    setHistory((prev) => ({
      ...prev,
      cases: prev.cases.map((c) => ({ ...c, chats: [] })),
      selectedChat: null,
    }))
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const MAX_FILE_SIZE = 100 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      alert("File size exceeds 100 MB limit.")
      return
    }

    setUploadedFile(file)

    // Skip backend upload for context mode
    if (currentMode === "context") return

    try {
      const formData = new FormData()
      formData.append("file", file)
      const response = await axios.post("/api/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })
      setInputValue((prevInput) => prevInput + " " + response.data.file_content)
    } catch (error) {
      console.error("Error uploading file:", error)
      alert("Error uploading file")
    }
  }

  // Add this useEffect near the top of the component with other effects
  useEffect(() => {
    // Clear any stale messages when switching chats
    setStreamingMessageId(null)
    setIsLoading(false)
  }, [history.selectedChat])

  useEffect(() => {
    // Close the editor when switching to a non-draft mode
    if (currentMode !== "draft") {
      setShowEditor(false)
    }
  }, [currentMode])

  const getCurrentChatMessages = () => {
    const history = getCurrentHistory()
    if (!history.selectedCase || !history.selectedChat) return []

    const currentCase = history.cases.find((c) => c.id === history.selectedCase)
    const currentChat = currentCase?.chats.find((chat) => chat.id === history.selectedChat)

    // Only return messages for the current chat
    return currentChat?.messages || []
  }

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      const messages = chatContainerRef.current.querySelectorAll(".group.relative")
      if (messages.length > 0) {
        // Get the last message
        const lastMessage = messages[messages.length - 1]
        // Scroll to the top of the last message
        lastMessage.scrollIntoView({ behavior: "smooth", block: "start" })
      } else {
        // Fallback to the old behavior if no messages are found
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
      }
    }
  }

  // Also modify the switchMode function to ensure editor is properly closed
  const switchMode = (mode: Mode) => {
    // First close the editor if we're switching away from draft mode
    if (currentMode === "draft" && mode !== "draft") {
      setShowEditor(false)
    }

    setCurrentMode(mode)
    setInputValue("")
    setUploadedFile(null)

    // Only reset editor content if we're switching to draft mode
    if (mode === "draft") {
      // Check if there's existing content for the current chat
      if (history.selectedChat && draftContents[history.selectedChat]) {
        setEditorContent(draftContents[history.selectedChat])
      } else {
        setEditorContent("")
      }
    }
  }

  const getModeIcon = (mode: Mode, isHeader = false) => {
    switch (mode) {
      case "research":
        return <Search className="h-4 w-4" />
      case "draft":
        return <FileText className="h-4 w-4" />
      case "context":
        return <BookOpen className="h-4 w-4" />
      case "chatbot":
        return <BalanceIcon className="h-4 w-4" />
      default:
        return <BalanceIcon className="h-4 w-4" />
    }
  }

  const getModeName = (mode: Mode) => {
    switch (mode) {
      case "research":
        return "Legal Research"
      case "draft":
        return "Draft Legal Notice"
      case "context":
        return "Context Files"
      case "chatbot":
        return "Legal Chatbot"
    }
  }

  const handleNewItemClick = (itemType: ChatType) => {
    if (!history.selectedCase) return
    createNewChat(history.selectedCase, itemType)
  }

  const undoDraft = () => {
    const currentDraft = draftVersions[currentVersionIndex]
    const currentHistory = currentDraft.history
    if (currentHistory.length > 1) {
      const newHistory = currentHistory.slice(0, -1)
      const undoneContent = currentHistory[currentHistory.length - 1]
      setDraftVersions((prev) => {
        const updatedVersions = [...prev]
        updatedVersions[currentVersionIndex] = {
          ...updatedVersions[currentVersionIndex],
          content: newHistory[newHistory.length - 1],
          history: newHistory,
          future: [...updatedVersions[currentVersionIndex].future, undoneContent],
        }
        return updatedVersions
      })
      setEditorContent(newHistory[newHistory.length - 1])
    }
  }

  const redoDraft = () => {
    const currentDraft = draftVersions[currentVersionIndex]
    const currentFuture = currentDraft.future
    if (currentFuture.length > 0) {
      const redoneContent = currentFuture[currentFuture.length - 1]
      setDraftVersions((prev) => {
        const updatedVersions = [...prev]
        updatedVersions[currentVersionIndex] = {
          ...updatedVersions[currentVersionIndex],
          content: redoneContent,
          history: [...updatedVersions[currentVersionIndex].history, redoneContent],
          future: currentFuture.slice(0, -1),
        }
        return updatedVersions
      })
      setEditorContent(redoneContent)
    }
  }

  // Modify the downloadDraft function to first show the modal dialog
  const downloadDraft = (format: "docx" | "pdf" | "txt") => {
    // Set the default filename and open the modal
    setDownloadDetails({
      format,
      fileName: `Drafted Notice`,
    })
    setIsDownloadModalOpen(true)
  }

  // Update the processDownload function to handle the Promise returned by HTMLtoDOCX
  const processDownload = () => {
    if (!downloadDetails) return

    const { format, fileName } = downloadDetails
    const content = editor?.getHTML() || ""
    const fullFileName = `${fileName}.${format}`

    switch (format) {
      case "docx":
        // Show a loading toast
        toast.info("Generating DOCX file...", {
          position: "top-center",
          autoClose: false,
          hideProgressBar: false,
          closeOnClick: false,
          pauseOnHover: false,
          draggable: false,
          progress: undefined,
          style: {
            backgroundColor: "#3b82f6",
            color: "#ffffff",
            fontSize: "12px",
            padding: "6px 10px",
            borderRadius: "6px",
          },
          toastId: "docx-generating",
        })

        // Use the improved HTMLtoDOCX function that returns a Promise
        HTMLtoDOCX(content, null, { orientation: "portrait" })
          .then((blob) => {
            saveAs(blob, fullFileName)

            // Close the modal after download is initiated
            setIsDownloadModalOpen(false)
            setDownloadDetails(null)

            // Dismiss the loading toast
            toast.dismiss("docx-generating")

            // Show a success notification
            toast.success(`✅ Document saved as ${fullFileName}`, {
              position: "top-center",
              autoClose: 2000,
              style: {
                backgroundColor: "#064e3b",
                color: "#ffffff",
                fontSize: "12px",
                padding: "6px 10px",
                borderRadius: "6px",
              },
            })
          })
          .catch((error) => {
            console.error("Error generating DOCX:", error)

            // Dismiss the loading toast
            toast.dismiss("docx-generating")

            toast.error("❌ Failed to generate DOCX file", {
              position: "top-center",
              autoClose: 3000,
              style: {
                backgroundColor: "#7f1d1d",
                color: "#ffffff",
                fontSize: "12px",
                padding: "6px 10px",
                borderRadius: "6px",
              },
            })
          })
        break

      // Keep the existing PDF and TXT cases unchanged
      case "pdf":
        // Create a temporary div to render the HTML content
        const tempDiv = document.createElement("div")
        tempDiv.innerHTML = content
        tempDiv.className = "pdf-export"

        // Apply styles to preserve formatting
        tempDiv.style.fontFamily = editorState.font
        tempDiv.style.fontSize = editor?.getAttributes("textStyle").fontSize || editorState.fontSize
        tempDiv.style.lineHeight = "1.5"
        tempDiv.style.padding = "40px"
        tempDiv.style.color = "#000"

        // Append to document temporarily (hidden)
        tempDiv.style.position = "absolute"
        tempDiv.style.left = "-9999px"
        document.body.appendChild(tempDiv)

        // Use html2canvas to capture the rendered content
        html2canvas(tempDiv, {
          scale: 3,
          useCORS: true,
          logging: false,
          backgroundColor: "#FFFFFF",
        }).then((canvas) => {
          const imgData = canvas.toDataURL("image/png")
          const pdf = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
          })

          const pdfWidth = pdf.internal.pageSize.getWidth()
          const pdfHeight = pdf.internal.pageSize.getHeight()
          const imgWidth = canvas.width
          const imgHeight = canvas.height
          const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight)
          const imgX = (pdfWidth - imgWidth * ratio) / 2
          const imgY = 10 // Top margin

          pdf.addImage(imgData, "PNG", imgX, imgY, imgWidth * ratio, imgHeight * ratio)

          // If content is longer than one page, add more pages
          const contentHeight = imgHeight * ratio
          if (contentHeight > pdfHeight - 20) {
            // 20mm for margins
            let remainingHeight = contentHeight
            let currentPosition = pdfHeight - 10 // 10mm bottom margin

            while (remainingHeight > 0) {
              pdf.addPage()
              const pageContentHeight = Math.min(remainingHeight, pdfHeight - 20)

              pdf.addImage(imgData, "PNG", imgX, imgY - currentPosition, imgWidth * ratio, imgHeight * ratio)

              remainingHeight -= pageContentHeight
              currentPosition += pdfHeight - 20
            }
          }

          // Save the PDF
          pdf.save(fullFileName)

          // Clean up
          document.body.removeChild(tempDiv)

          // Close the modal after download is initiated
          setIsDownloadModalOpen(false)
          setDownloadDetails(null)

          // Show a success notification
          toast.success(`✅ Document saved as ${fullFileName}`, {
            position: "top-center",
            autoClose: 2000,
            style: {
              backgroundColor: "#064e3b",
              color: "#ffffff",
              fontSize: "12px",
              padding: "6px 10px",
              borderRadius: "6px",
            },
          })
        })
        break
      case "txt":
        const textContent = editor?.getText() || ""
        const textBlob = new Blob([textContent], { type: "text/plain;charset=utf-8" })
        saveAs(textBlob, fullFileName)

        // Close the modal after download is initiated
        setIsDownloadModalOpen(false)
        setDownloadDetails(null)

        // Show a success notification
        toast.success(`✅ Document saved as ${fullFileName}`, {
          position: "top-center",
          autoClose: 2000,
          style: {
            backgroundColor: "#064e3b",
            color: "#ffffff",
            fontSize: "12px",
            padding: "6px 10px",
            borderRadius: "6px",
          },
        })
        break
    }
  }

  const handleRename = (id: string, type: "case" | "chat" | "research" | "draft" | "context", currentName: string) => {
    setRenameItem({ id, type, name: currentName })
  }

  const submitRename = (newName: string) => {
    if (!renameItem) return

    setHistory((prev) => ({
      ...prev,
      cases: prev.cases.map((case_) => {
        if (renameItem.type === "case" && case_.id === renameItem.id) {
          return { ...case_, name: newName }
        }
        return {
          ...case_,
          chats: case_.chats.map((chat) => {
            if (["chat", "research", "draft", "context"].includes(renameItem.type) && chat.id === renameItem.id) {
              return { ...chat, name: newName }
            }
            return chat
          }),
        }
      }),
    }))

    setRenameItem(null)
  }

  const handleDelete = (id: string, type: "case" | "chat" | "research" | "draft" | "context") => {
    setHistory((prev) => {
      if (type === "case") {
        return {
          ...prev,
          cases: prev.cases.filter((c) => c.id !== id),
          selectedCase: prev.selectedCase === id ? null : prev.selectedCase,
          selectedChat: prev.selectedCase === id ? null : prev.selectedChat,
        }
      } else {
        return {
          ...prev,
          cases: prev.cases.map((c) => ({ ...c, chats: [] })),
          selectedChat: prev.selectedChat === id ? null : prev.selectedChat,
        }
      }
    })
  }

  const toggleFavorite = (caseId: string, chatId: string | null = null) => {
    setHistory((prev) => ({
      ...prev,
      cases: prev.cases.map((case_) => {
        if (case_.id === caseId) {
          if (chatId) {
            return {
              ...case_,
              chats: case_.chats.map((chat) => {
                if (chat.id === chatId) {
                  return { ...chat, favorite: !chat.favorite }
                }
                return chat
              }),
            }
          } else {
            return { ...case_, favorite: !case_.favorite }
          }
        }
        return case_
      }),
    }))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        console.log("Text copied to clipboard")
      },
      (err) => {
        console.error("Could not copy text: ", err)
      },
    )
  }

  const deleteMessage = (messageId: string) => {
    setHistory((prev) => ({
      ...prev,
      cases: prev.cases.map((case_) => {
        if (case_.id === prev.selectedCase) {
          return {
            ...case_,
            chats: case_.chats.map((chat) => {
              if (chat.id === prev.selectedChat) {
                return {
                  ...chat,
                  messages: chat.messages.filter((msg) => msg.id !== messageId),
                }
              }
              return chat
            }),
          }
        }
        return case_
      }),
    }))
  }

  const applyStyle = (style: "bold" | "italic" | "underline") => {
    if (!editor) return

    editor.chain().focus().toggleMark(style).run()
  }

  const changeFont = (font: string) => {
    setEditorState((prev) => ({ ...prev, font }))
  }

  const forkChat = (caseId: string, chatId: string) => {
    const existingCase = history.cases.find((c) => c.id === caseId)
    const existingChat = existingCase?.chats.find((chat) => chat.id === chatId)

    if (!existingChat) return

    // Create a new case ID and name
    const newCaseId = `case-fork-${Date.now()}`
    const newCaseName = `${existingCase?.name || "Case"} (Fork)`

    // Create a new chat for the new case
    const newChat: Chat = {
      ...existingChat,
      id: `${newCaseId}-chat-${Date.now()}`,
      name: existingChat.name,
      messages: [...existingChat.messages],
    }

    // Create a new case with the forked chat
    const newCase: Case = {
      id: newCaseId,
      name: newCaseName,
      chats: [newChat],
      favorite: false,
    }

    // Update history with the new case
    setHistory((prev) => ({
      ...prev,
      // Add the new case to the beginning of the cases array
      cases: [newCase, ...prev.cases],
      selectedCase: newCaseId,
      selectedChat: newChat.id,
    }))

    // Expand the new case in the sidebar
    setExpandedCases((prev) => ({
      ...prev,
      [newCaseId]: true,
    }))

    // Set the mode based on the chat type
    switch (newChat.type) {
      case "research":
        setCurrentMode("research")
        break
      case "draft":
        setCurrentMode("draft")
        break
      case "context":
        setCurrentMode("context")
        break
      default:
        setCurrentMode("chatbot")
    }

    // Show a success toast
    toast.success("✅ Chat forked to new case successfully", {
      position: "top-center",
      autoClose: 2000,
      style: {
        backgroundColor: "#064e3b",
        color: "#ffffff",
        fontSize: "12px",
        padding: "6px 10px",
        borderRadius: "6px",
      },
    })
  }

  const forkChatToSameCase = (caseId: string, chatId: string) => {
    const existingChat = history.cases.find((c) => c.id === caseId)?.chats.find((chat) => chat.id === chatId)

    if (!existingChat) return

    const existingForks =
      history.cases
        .find((c) => c.id === caseId)
        ?.chats.filter((chat) => chat.name.startsWith(existingChat.name) && chat.name !== existingChat.name) || []

    const forkNumber = existingForks.length + 1
    const newChat: Chat = {
      ...existingChat,
      id: `${caseId}-${existingChat.type}-${Date.now()}`,
      name: `${existingChat.name}(${forkNumber})`,
      messages: [...existingChat.messages],
    }

    setHistory((prev) => ({
      ...prev,
      cases: prev.cases.map((c) => {
        if (c.id === caseId) {
          return {
            ...c,
            chats: [...c.chats, newChat],
          }
        }
        return c
      }),
      selectedChat: newChat.id,
    }))

    setExpandedCases((prev) => ({
      ...prev,
      [caseId]: true,
    }))
  }

  const handleContextFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    // Check size for each file
    const MAX_FILE_SIZE = 100 * 1024 * 1024
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`File ${file.name} exceeds 100 MB limit.`)
        return
      }
    }

    const currentCase = history.cases.find((c) => c.id === history.selectedCase)
    const currentChat = currentCase?.chats.find((chat) => chat.id === history.selectedChat)

    if (currentChat && currentChat.type === "context") {
      setHistory((prev) => ({
        ...prev,
        cases: prev.cases.map((c) => {
          if (c.id === history.selectedCase) {
            return {
              ...c,
              chats: c.chats.map((chat) => {
                if (chat.id === history.selectedChat) {
                  return {
                    ...chat,
                    contextFiles: [...(chat.contextFiles || []), ...files],
                  }
                }
                return chat
              }),
            }
          }
          return c
        }),
      }))

      toast.success(`✅ ${files.length} file(s) uploaded successfully`, {
        position: "top-center",
        autoClose: 2000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        style: {
          backgroundColor: "#064e3b", // Dark green background
          color: "#ffffff", // White text
          fontSize: "12px", // Smaller font size
          padding: "6px 10px", // Reduce padding
          borderRadius: "6px", // Reduce border radius
          minWidth: "150px",
        },
      })
    }
  }

  const viewContextFile = (file: File) => {
    const fileUrl = URL.createObjectURL(file)
    setFileViewerModal({
      open: true,
      content: fileUrl,
      type: file.type,
    })
  }

  const deleteContextFile = (caseId: string, chatId: string) => {
    setHistory((prev) => ({
      ...prev,
      cases: prev.cases.map((c) => {
        if (c.id === caseId) {
          return {
            ...c,
            chats: c.chats.map((chat) => {
              if (chat.id === history.selectedChat) {
                return { ...chat, contextFile: undefined }
              }
              return chat
            }),
          }
        }
        return c
      }),
    }))
    toast.success("✅ Context file deleted", {
      position: "top-center",
      autoClose: 2000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      style: {
        backgroundColor: "#064e3b", // Dark green background
        color: "#ffffff", // White text
        fontSize: "12px", // Smaller font size
        padding: "6px 10px", // Reduce padding
        borderRadius: "6px", // Reduce border radius
        minWidth: "150px",
      },
    })
  }

  const [editorWidth, setEditorWidth] = useState(50) // 50% of screen width by default
  const [isResizing, setIsResizing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [editorPosition, setEditorPosition] = useState({ x: 0, y: 0 })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const resizeHandleRef = useRef<HTMLDivElement>(null)
  const editorPanelRef = useRef<HTMLDivElement>(null)
  const dragStartPosition = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        // Calculate new width based on mouse position
        const newWidth = 100 - (e.clientX / window.innerWidth) * 100
        // Limit the width between 30% and 70%
        setEditorWidth(Math.min(Math.max(newWidth, 30), 70))
      } else if (isDragging && editorPanelRef.current) {
        const dx = e.clientX - dragStartPosition.current.x
        const dy = e.clientY - dragStartPosition.current.y

        setEditorPosition((prev) => ({
          x: prev.x + dx,
          y: prev.y + dy,
        }))

        dragStartPosition.current = { x: e.clientX, y: e.clientY }
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      setIsDragging(false)
    }

    if (isResizing || isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isResizing, isDragging])

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }

  const startDragging = (e: React.MouseEvent) => {
    if (e.target === resizeHandleRef.current) return

    e.preventDefault()
    setIsDragging(true)
    dragStartPosition.current = { x: e.clientX, y: e.clientY }
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
    if (!isFullscreen) {
      // Save current position and width before going fullscreen
      setEditorPosition({ x: 0, y: 0 })
    }
  }

  // Add this useEffect near the other useEffect hooks
  useEffect(() => {
    // Automatically collapse sidebar when editor is shown
    if (showEditor) {
      setIsSidebarCollapsed(true)
    }
  }, [showEditor])

  useEffect(() => {
    // Automatically collapse sidebar when editor is shown
    // and expand it when editor is closed
    if (showEditor) {
      setIsSidebarCollapsed(true)
    } else {
      setIsSidebarCollapsed(false)
    }
  }, [showEditor])

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div
        className={`${
          isSidebarCollapsed ? "w-16" : "w-64"
        } bg-purple-900 text-white flex flex-col transition-all duration-300`}
      >
        <div className="p-4 border-b border-purple-800 flex items-center justify-between">
          {!isSidebarCollapsed && <h1 className="text-xl font-bold text-center ml-auto mr-10">LegalThinkAI</h1>}
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-purple-800"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {!isSidebarCollapsed && (
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-2">Options</h3>
                <div className="space-y-1">
                  {(["research", "draft", "chatbot"] as Mode[]).map((mode) => (
                    <Button
                      key={mode}
                      variant="ghost"
                      className={`w-full justify-start text-white hover:bg-purple-800 ${
                        currentMode === mode ? "bg-purple-800" : ""
                      }`}
                      onClick={() => switchMode(mode)}
                    >
                      {getModeIcon(mode)}
                      <span className="ml-2">{getModeName(mode)}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-2">Favorites</h3>
                <div className="space-y-1">
                  {getCurrentHistory()
                    .cases.filter((case_) => case_.favorite)
                    .map((case_) => (
                      <div key={case_.id} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Button
                            variant="ghost"
                            className={`w-full justify-start text-white hover:bg-purple-800 ${
                              getCurrentHistory().selectedCase === case_.id ? "bg-purple-800" : ""
                            }`}
                            onClick={() => toggleCase(case_.id)}
                          >
                            <Star className="mr-2 h-3 w-3 fill-current" />
                            <span className="truncate">{case_.name}</span>
                            {expandedCases[case_.id] ? (
                              <ChevronDown className="ml-auto h-4 w-4" />
                            ) : (
                              <ChevronRight className="ml-auto h-4 w-4" />
                            )}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="px-2">
                                <MoreVertical className="h-4 w-4 text-white" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onSelect={() => toggleFavorite(case_.id)}>
                                <Star className="mr-2 h-4 w-4 fill-yellow-400" />
                                Unfavorite
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => handleDelete(case_.id, "case")}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => handleRename(case_.id, "case", case_.name)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => forkCase(case_)}>
                                <ForkIcon className="mr-2 h-4 w-4" />
                                Fork Case
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {expandedCases[case_.id] && (
                          <div className="ml-6 space-y-1">
                            {case_.chats.map((chat) => (
                              <div key={chat.id} className="flex items-center justify-between">
                                <Button
                                  variant="ghost"
                                  className={`w-full justify-start text-white hover:bg-purple-800 py-1 text-sm ${
                                    getCurrentHistory().selectedChat === chat.id ? "bg-purple-800" : ""
                                  }`}
                                  onClick={() => selectChat(case_.id, chat.id)}
                                >
                                  {chat.favorite ? (
                                    <Star className="mr-2 h-3 w-3 fill-current" />
                                  ) : (
                                    <div className="mr-2">{getModeIcon(chat.type as Mode)}</div>
                                  )}
                                  <span className="truncate">{chat.name}</span>
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="px-2">
                                      <MoreVertical className="h-4 w-4 text-white" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent>
                                    <DropdownMenuItem onSelect={() => toggleFavorite(case_.id, chat.id)}>
                                      <Star className="mr-2 h-4 w-4 fill-yellow-400" />
                                      Unfavorite
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handleDelete(chat.id, chat.type)}>
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handleRename(chat.id, chat.type, chat.name)}>
                                      <Edit className="mr-2 h-4 w-4" />
                                      Rename
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => forkChatToSameCase(case_.id, chat.id)}>
                                      <ForkIcon className="mr-2 h-4 w-4" />
                                      Fork Chat
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => forkChat(case_.id, chat.id)}>
                                      <ForkIcon className="mr-2 h-4 w-4" />
                                      Fork Chat to New Case
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  {getCurrentHistory().cases.flatMap((case_) =>
                    case_.chats
                      .filter((chat) => chat.favorite && !case_.favorite)
                      .map((chat) => (
                        <div key={chat.id} className="flex items-center justify-between">
                          <Button
                            variant="ghost"
                            className={`w-full justify-start text-white hover:bg-purple-800 ${
                              getCurrentHistory().selectedChat === chat.id ? "bg-purple-800" : ""
                            }`}
                            onClick={() => selectChat(case_.id, chat.id)}
                          >
                            <Star className="mr-2 h-3 w-3 fill-current" />
                            <span className="truncate">{chat.name}</span>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="px-2">
                                <MoreVertical className="h-4 w-4 text-white" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onSelect={() => toggleFavorite(case_.id, chat.id)}>
                                <Star className="mr-2 h-4 w-4 fill-yellow-400" />
                                Unfavorite
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => handleDelete(chat.id, chat.type)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => handleRename(chat.id, chat.type, chat.name)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => forkChatToSameCase(case_.id, chat.id)}>
                                <ForkIcon className="mr-2 h-4 w-4" />
                                Fork Chat
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => forkChat(case_.id, chat.id)}>
                                <ForkIcon className="mr-2 h-4 w-4" />
                                Fork Chat to New Case
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )),
                  )}
                </div>
              </div>

              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-semibold">History</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-purple-800"
                    onClick={createNewCase}
                  >
                    <FolderPlus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {getCurrentHistory().cases.map((case_) => (
                    <div key={case_.id}>
                      <div className="flex items-center justify-between">
                        <Button
                          variant="ghost"
                          className={`w-full justify-between text-white hover:bg-purple-800 py-2 ${
                            getCurrentHistory().selectedCase === case_.id ? "bg-purple-800/50" : ""
                          }`}
                          onClick={() => {
                            toggleCase(case_.id)
                            selectCase(case_.id)
                          }}
                        >
                          <span>{case_.name}</span>
                          {expandedCases[case_.id] ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="px-2">
                              <MoreVertical className="h-4 w-4 text-white" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onSelect={() => toggleFavorite(case_.id)}>
                              <Star className={`mr-2 h-4 w-4 ${case_.favorite ? "fill-yellow-400" : ""}`} />
                              {case_.favorite ? "Unfavorite" : "Favorite"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => handleRename(case_.id, "case", case_.name)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => forkCase(case_)}>
                              <ForkIcon className="mr-2 h-4 w-4" />
                              Fork Case
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => handleDelete(case_.id, "case")} className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Case
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {expandedCases[case_.id] && (
                        <div className="ml-4 space-y-1 mt-1">
                          {case_.chats.map((chat) => (
                            <div key={chat.id} className="flex items-center justify-between">
                              <Button
                                variant="ghost"
                                className={`w-full justify-start text-white hover:bg-purple-800 py-1 text-sm ${
                                  getCurrentHistory().selectedChat === chat.id ? "bg-purple-800" : ""
                                }`}
                                onClick={() => selectChat(case_.id, chat.id)}
                              >
                                {chat.favorite ? (
                                  <Star className="mr-2 h-3 w-3 fill-current" />
                                ) : (
                                  <div className="mr-2">{getModeIcon(chat.type as Mode)}</div>
                                )}
                                <span className="truncate">{chat.name}</span>
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="px-2">
                                    <MoreVertical className="h-4 w-4 text-white" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  <DropdownMenuItem onSelect={() => toggleFavorite(case_.id, chat.id)}>
                                    <Star className={`mr-2 h-4 w-4 ${chat.favorite ? "fill-yellow-400" : ""}`} />
                                    {chat.favorite ? "Unfavorite" : "Favorite"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => handleRename(chat.id, chat.type, chat.name)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Rename
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onSelect={() => handleDelete(chat.id, chat.type)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete {chat.type.charAt(0).toUpperCase() + chat.type.slice(1)}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => forkChatToSameCase(case_.id, chat.id)}>
                                    <ForkIcon className="mr-2 h-4 w-4" />
                                    Fork Chat
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => forkChat(case_.id, chat.id)}>
                                    <ForkIcon className="mr-2 h-4 w-4" />
                                    Fork Chat to New Case
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          ))}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                className="w-full justify-start text-white hover:bg-purple-800 py-1 text-sm"
                              >
                                <Plus className="mr-2 h-3 w-3" />
                                New...
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onSelect={() => handleNewItemClick("chat")}>
                                <MessageSquare className="mr-2 h-4 w-4" />
                                New Chat
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => handleNewItemClick("research")}>
                                <Search className="mr-2 h-4 w-4" />
                                New Research
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => handleNewItemClick("draft")}>
                                <FileText className="mr-2 h-4 w-4" />
                                New Draft
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => handleNewItemClick("context")}>
                                <BookOpen className="mr-2 h-4 w-4" />
                                New Context
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-purple-800">
          {!isSidebarCollapsed && (
            <>
              <Button
                variant="ghost"
                className="w-full justify-start text-white hover:bg-purple-800"
                onClick={() => setShowSettings(true)}
              >
                <Settings className="h-4 w-4" />
                <span className="ml-2">Settings</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div
        className={`flex-1 flex flex-col ${showEditor && currentMode === "draft" && !isFullscreen ? `mr-[${editorWidth}%]` : ""}`}
      >
        <header className="bg-white border-b p-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              {getModeIcon(currentMode, true)}
              <h2 className="text-xl font-semibold text-purple-900 ml-2">
                {getCurrentHistory()
                  .cases.find((c) => c.id === getCurrentHistory().selectedCase)
                  ?.chats.find((chat) => chat.id === getCurrentHistory().selectedChat)?.name ||
                  getModeName(currentMode)}
              </h2>
            </div>
            {currentMode === "draft" && !showEditor && (
              <Button
                variant="outline"
                size="sm"
                className="text-purple-600 border-purple-600 hover:bg-purple-50"
                onClick={() => {
                  // Load the content specific to this draft chat
                  if (history.selectedChat) {
                    if (draftContents[history.selectedChat]) {
                      setEditorContent(draftContents[history.selectedChat])
                    } else {
                      // If no content exists yet, start with an empty editor
                      setEditorContent("")
                      setDraftContents((prev) => ({
                        ...prev,
                        [history.selectedChat]: "",
                      }))
                    }
                    setShowEditor(true)
                    setIsSidebarCollapsed(true) // Auto-collapse sidebar when editor is opened
                  }
                }}
              >
                <FileText className="mr-2 h-4 w-4" />
                Open Draft
              </Button>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-gray-500">Aishik.D.Gupta</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                  <Share2 className="h-5 w-5" />
                  <span>Share</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    // Share current chat
                    toast.success("Chat link copied to clipboard!", {
                      position: "top-center",
                      autoClose: 2000,
                      style: {
                        backgroundColor: "#064e3b",
                        color: "#ffffff",
                        fontSize: "12px",
                        padding: "6px 10px",
                        borderRadius: "6px",
                      },
                    })
                  }}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Share Chat
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    // Share current case
                    toast.success("Case link copied to clipboard!", {
                      position: "top-center",
                      autoClose: 2000,
                      style: {
                        backgroundColor: "#064e3b",
                        color: "#ffffff",
                        fontSize: "12px",
                        padding: "6px 10px",
                        borderRadius: "6px",
                      },
                    })
                  }}
                >
                  <FolderPlus className="mr-2 h-4 w-4" />
                  Share Case
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {currentMode !== "context" && (
          <div className="flex-1 overflow-y-auto p-4 pb-16 bg-gray-100" ref={chatContainerRef}>
            {getCurrentChatMessages().map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"} mb-4 group relative min-h-[80px]`}
              >
                <div
                  className={`w-full max-w-[60%] p-4 rounded-lg shadow whitespace-normal ${
                    message.sender === "user" ? "bg-purple-900 text-white" : "bg-white"
                  }`}
                >
                  {message.text &&
                    (message.sender === "ai" ? (
                      <StreamingText
                        text={message.summary || message.text}
                        isComplete={message.id !== streamingMessageId}
                        onComplete={() => {
                          if (message.id === streamingMessageId) {
                            setStreamingMessageId(null)
                            setIsLoading(false)
                          }
                        }}
                      />
                    ) : (
                      <ReactMarkdown className="prose prose-sm max-w-none dark:prose-invert text-black">
                        {message.summary || message.text}
                      </ReactMarkdown>
                    ))}
                  {message.file && (
                    <div
                      className={`mt-2 flex items-center gap-2 rounded p-2 cursor-pointer ${
                        message.sender === "user" ? "bg-purple-800" : "bg-gray-100"
                      }`}
                      onClick={() =>
                        message.file &&
                        setFileViewerModal({
                          open: true,
                          content: URL.createObjectURL(uploadedFile as File),
                          type: message.file.type,
                        })
                      }
                    >
                      <FileText className={`h-4 w-4 ${message.sender === "user" ? "text-white" : "text-gray-500"}`} />
                      <div className={`flex flex-col ${message.sender === "user" ? "text-white" : "text-gray-600"}`}>
                        <span className="text-sm font-medium">{message.file.name}</span>
                        <span className="text-xs">{(message.file.size / (1024 * 1024)).toFixed(2)}MB</span>
                      </div>
                    </div>
                  )}
                  <div className="absolute top-0 right-0 mt-1 mr-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
                            onClick={() => {
                              copyToClipboard(message.summary || message.text)
                              toast.success("✅ Message copied to clipboard!", {
                                position: "top-center",
                                autoClose: 2000,
                                style: {
                                  backgroundColor: "#064e3b",
                                  color: "#ffffff",
                                  fontSize: "12px",
                                  padding: "6px 10px",
                                  borderRadius: "6px",
                                },
                              })
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Copy message</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
                            onClick={() => {
                              deleteMessage(message.id)

                              toast.info("🗑️ Message deleted", {
                                position: "top-center",
                                autoClose: 1500,
                                hideProgressBar: false,
                                closeOnClick: true,
                                pauseOnHover: false,
                                draggable: false,
                                progress: undefined,
                                style: {
                                  backgroundColor: "#7f1d1d", // Dark red
                                  color: "#ffffff", // White text
                                  fontSize: "12px",
                                  fontWeight: "bold",
                                  borderRadius: "8px",
                                },
                              })
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete message</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && <Spinner legalDomain={consultingAgent} mode={currentMode} stage={processingStage} />}
            <ToastContainer position="top-center" autoClose={2000} hideProgressBar={false} closeOnClick={true} />
          </div>
        )}
        {currentMode === "draft" && showEditor && (
          <div
            ref={editorPanelRef}
            className={`fixed bg-white border border-gray-300 flex flex-col shadow-lg rounded-lg ${
              isFullscreen ? "inset-4 z-50" : "h-screen"
            }`}
            style={{
              width: isFullscreen ? "auto" : `${editorWidth}%`,
              right: isFullscreen ? undefined : editorPosition.x,
              top: isFullscreen ? undefined : editorPosition.y,
              transform: isFullscreen ? "none" : `translateX(${editorPosition.x}px) translateY(${editorPosition.y}px)`,
              transition: isFullscreen ? "all 0.3s ease" : "none",
            }}
          >
            <div className="bg-white border-b p-4 flex flex-col space-y-4 cursor-move" onMouseDown={startDragging}>
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-semibold text-purple-900">Drafted Notice</h1>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleFullscreen}
                    className="hover:bg-gray-200 text-gray-700"
                  >
                    {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setLatestDraftResponse(editorContent)
                      setShowEditor(false)
                      setIsSidebarCollapsed(false) // Ensure sidebar opens when editor is closed
                    }}
                    className="hover:bg-gray-200 text-gray-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between overflow-x-auto flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => editor?.chain().focus().toggleBold().run()}
                      className={`h-7 w-7 sm:h-8 sm:w-8 p-1 hover:bg-gray-200 text-gray-700 ${editor?.isActive("bold") ? "bg-gray-200" : ""}`}
                    >
                      <Bold className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => editor?.chain().focus().toggleItalic().run()}
                      className={`h-7 w-7 sm:h-8 sm:w-8 p-1 hover:bg-gray-200 text-gray-700 ${editor?.isActive("italic") ? "bg-gray-200" : ""}`}
                    >
                      <Italic className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 sm:h-8 sm:w-8 p-1 hover:bg-gray-200 text-gray-700"
                      >
                        <AlignRight className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => editor?.chain().focus().lift().setTextAlign("left").run()}>
                        <AlignLeft className="h-4 w-4 mr-2" />
                        Left
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => editor?.chain().focus().lift().setTextAlign("center").run()}>
                        <AlignCenter className="h-4 w-4 mr-2" />
                        Center
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => editor?.chain().focus().lift().setTextAlign("right").run()}>
                        <AlignRight className="h-4 w-4 mr-2" />
                        Right
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => editor?.chain().focus().lift().setTextAlign("justify").run()}>
                        <AlignJustify className="h-4 w-4 mr-2" />
                        Justify
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 sm:h-8 sm:w-8 p-1 hover:bg-gray-200 text-gray-700"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-3 w-3 sm:h-4 sm:w-4"
                        >
                          <line x1="8" y1="6" x2="21" y2="6"></line>
                          <line x1="8" y1="12" x2="21" y2="12"></line>
                          <line x1="8" y1="18" x2="21" y2="18"></line>
                          <line x1="3" y1="6" x2="3.01" y2="6"></line>
                          <line x1="3" y1="12" x2="3.01" y2="12"></line>
                          <line x1="3" y1="18" x2="3.01" y2="18"></line>
                        </svg>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => editor?.chain().focus().toggleBulletList().run()}>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4 mr-2"
                        >
                          <line x1="8" y1="6" x2="21" y2="6"></line>
                          <line x1="8" y1="12" x2="21" y2="12"></line>
                          <line x1="8" y1="18" x2="21" y2="18"></line>
                          <line x1="3" y1="6" x2="3.01" y2="6"></line>
                          <line x1="3" y1="12" x2="3.01" y2="12"></line>
                          <line x1="3" y1="18" x2="3.01" y2="18"></line>
                        </svg>
                        Bullet List
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4 mr-2"
                        >
                          <line x1="10" y1="6" x2="21" y2="6"></line>
                          <line x1="10" y1="12" x2="21" y2="12"></line>
                          <line x1="10" y1="18" x2="21" y2="18"></line>
                          <text x="3" y="8" fontSize="8" fontWeight="bold">
                            1
                          </text>
                          <text x="3" y="14" fontSize="8" fontWeight="bold">
                            2
                          </text>
                          <text x="3" y="20" fontSize="8" fontWeight="bold">
                            3
                          </text>
                        </svg>
                        Numbered List (1, 2, 3)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          // For alphabetical list, we'll use ordered list with a custom marker
                          editor?.chain().focus().toggleOrderedList().run()
                          // Apply a custom CSS class for alphabetical markers
                          const lists = document.querySelectorAll(".ProseMirror ol")
                          lists.forEach((list) => {
                            list.style.listStyleType = "lower-alpha"
                          })
                        }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4 mr-2"
                        >
                          <line x1="10" y1="6" x2="21" y2="6"></line>
                          <line x1="10" y1="12" x2="21" y2="12"></line>
                          <line x1="10" y1="18" x2="21" y2="18"></line>
                          <text x="3" y="8" fontSize="8" fontWeight="bold">
                            a
                          </text>
                          <text x="3" y="14" fontSize="8" fontWeight="bold">
                            b
                          </text>
                          <text x="3" y="20" fontSize="8" fontWeight="bold">
                            c
                          </text>
                        </svg>
                        Alphabetical List (a, b, c)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          // For checkbox list, we'll use a task list if available, or simulate with bullet list
                          if (editor?.can().toggleTaskList()) {
                            editor.chain().focus().toggleTaskList().run()
                          } else {
                            // Fallback to bullet list with a custom marker
                            editor?.chain().focus().toggleBulletList().run()
                            const lists = document.querySelectorAll(".ProseMirror ul")
                            lists.forEach((list) => {
                              list.style.listStyleType = "square"
                            })
                          }
                        }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4 mr-2"
                        >
                          <rect x="3" y="5" width="4" height="4" rx="1"></rect>
                          <rect x="3" y="11" width="4" height="4" rx="1"></rect>
                          <rect x="3" y="17" width="4" height="4" rx="1"></rect>
                          <line x1="10" y1="7" x2="21" y2="7"></line>
                          <line x1="10" y1="13" x2="21" y2="13"></line>
                          <line x1="10" y1="19" x2="21" y2="19"></line>
                        </svg>
                        Checkbox List
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Select
                    onValueChange={(size) => {
                      // Always apply the font size, even if it's the same as current selection
                      editor?.chain().focus().setFontSize(size).run()
                    }}
                    value={editor?.getAttributes("textStyle").fontSize || ""}
                  >
                    <SelectTrigger className="w-[60px]">
                      <Type className="h-4 w-4" />
                    </SelectTrigger>
                    <SelectContent>
                      {["12pt", "14pt", "16pt", "18pt", "20pt"].map((size) => (
                        <SelectItem
                          key={size}
                          value={size}
                          onSelect={() => {
                            // Force apply the font size when clicking directly on the item
                            editor?.chain().focus().setFontSize(size).run()
                          }}
                        >
                          <div
                            className={`${editor?.isActive("fontSize", size) ? "bg-gray-200" : ""} px-2 py-1 rounded`}
                          >
                            {size}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={undoDraft}
                    disabled={draftVersions[currentVersionIndex]?.history.length <= 1}
                    className="hover:bg-gray-200 text-gray-700"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="hover:bg-gray-200 text-gray-700">
                        V{currentVersionIndex + 1}
                        <ChevronDown className="h-4 w-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {draftVersions.map((_, index) => (
                        <DropdownMenuItem
                          key={index}
                          onSelect={() => {
                            setCurrentVersionIndex(index)
                            setEditorContent(draftVersions[index].content)
                          }}
                        >
                          V{index + 1}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={redoDraft}
                    disabled={draftVersions[currentVersionIndex]?.future.length === 0}
                    className="hover:bg-gray-200 text-gray-700"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <style>{editorStyles}</style>
            <div className="flex-1 overflow-hidden flex relative">
              {/* Resize handle */}
              <div
                ref={resizeHandleRef}
                className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-purple-300 z-10"
                onMouseDown={startResizing}
              />
              <div
                className="w-[50px] flex-shrink-0 bg-gray-100 p-2 text-right text-sm text-gray-500 select-none border-r border-gray-300 overflow-y-hidden"
                style={{
                  position: "sticky",
                  top: 0,
                  height: "100%",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {Array.from({ length: Math.max(editorContent.split("\n").length, 1) }).map((_, i) => (
                  <div key={i + 1} className="leading-[24px] h-[24px]">
                    {i + 1}
                  </div>
                ))}
              </div>
              <EditorContent
                editor={editor}
                className="flex-1 overflow-y-auto prose prose-sm max-w-none"
                style={{
                  fontFamily: editorState.font,
                  fontSize: editor?.getAttributes("textStyle").fontSize || editorState.fontSize,
                  lineHeight: "1.6",
                }}
              />

              <div className="absolute bottom-4 right-4 flex space-x-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="hover:bg-gray-200 text-gray-700">
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onSelect={() => {
                        const content = editor?.getText() || ""
                        navigator.clipboard.writeText(content).then(
                          () => {
                            toast.success("✅ Copied as plain text", {
                              position: "top-center",
                              autoClose: 2000,
                              style: {
                                backgroundColor: "#064e3b",
                                color: "#ffffff",
                                fontSize: "12px",
                                padding: "6px 10px",
                                borderRadius: "6px",
                              },
                            })
                          },
                          (err) => {
                            console.error("Could not copy text: ", err)
                            toast.error("❌ Failed to copy text", {
                              position: "top-center",
                              autoClose: 2000,
                              style: {
                                backgroundColor: "#7f1d1d",
                                color: "#ffffff",
                                fontSize: "12px",
                                padding: "6px 10px",
                                borderRadius: "6px",
                              },
                            })
                          },
                        )
                      }}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Copy as Plain Text
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        const content = editor?.getHTML() || ""
                        const markdown = htmlToMarkdown(content)
                        navigator.clipboard.writeText(markdown).then(
                          () => {
                            toast.success("✅ Copied as Markdown", {
                              position: "top-center",
                              autoClose: 2000,
                              style: {
                                backgroundColor: "#064e3b",
                                color: "#ffffff",
                                fontSize: "12px",
                                padding: "6px 10px",
                                borderRadius: "6px",
                              },
                            })
                          },
                          (err) => {
                            console.error("Could not copy markdown: ", err)
                            toast.error("❌ Failed to copy markdown", {
                              position: "top-center",
                              autoClose: 2000,
                              style: {
                                backgroundColor: "#7f1d1d",
                                color: "#ffffff",
                                fontSize: "12px",
                                padding: "6px 10px",
                                borderRadius: "6px",
                              },
                            })
                          },
                        )
                      }}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Copy as Markdown
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="hover:bg-gray-200 text-gray-700">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => downloadDraft("docx")}>
                      <FileText className="mr-2 h-4 w-4" />
                      Download as DOCX
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => downloadDraft("pdf")}>
                      <FileText className="mr-2 h-4 w-4" />
                      Download as PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => downloadDraft("txt")}>
                      <FileText className="mr-2 h-4 w-4" />
                      Download as TXT
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        )}
        {currentMode === "context" && (
          <ToastContainer
            position="top-center"
            autoClose={2000}
            hideProgressBar={false}
            closeOnClick={true}
            pauseOnHover={true}
            draggable={true}
          />
        )}
        {currentMode === "context" && (
          <div className="flex-1 flex flex-col">
            <header className="bg-white border-b p-4 flex justify-between items-center">
              <div className="flex items-center">
                <BookOpen className="h-4 w-4" />
                <h2 className="text-xl font-semibold text-purple-900 ml-2">Context Files</h2>
              </div>
              <Button
                variant="secondary"
                className="bg-purple-600 text-white hover:bg-purple-700"
                onClick={async () => {
                  const currentCase = history.cases.find((c) => c.id === history.selectedCase)
                  const currentChat = currentCase?.chats.find((chat) => chat.id === history.selectedChat)

                  if (!currentChat?.contextFiles?.length) {
                    toast.error("❌ No files to save", {
                      position: "top-center",
                      autoClose: 2000,
                      hideProgressBar: false,
                      closeOnClick: true,
                      pauseOnHover: true,
                      draggable: true,
                      progress: undefined,
                      style: {
                        backgroundColor: "#7f1d1d", // Dark red background
                        color: "#ffffff", // White text
                        fontSize: "12px", // Smaller font size
                        padding: "6px 10px", // Reduce padding
                        borderRadius: "6px", // Reduce border radius
                        minWidth: "150px",
                      },
                    })
                    return
                  }

                  setIsLoading(true)
                  setProcessingStage("consulting")

                  // Simulate file analysis - 5 seconds
                  await new Promise((resolve) => setTimeout(resolve, 5000))

                  setProcessingStage("processing")

                  // Simulate saving - 3 seconds
                  await new Promise((resolve) => setTimeout(resolve, 3000))

                  setIsLoading(false)
                  setProcessingStage("consulting")

                  toast.success("✅ Context files processed and saved successfully", {
                    position: "top-center",
                    autoClose: 2000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    style: {
                      backgroundColor: "#064e3b", // Dark green background
                      color: "#ffffff", // White text
                      fontSize: "12px", // Smaller font size
                      padding: "6px 10px", // Reduce padding
                      borderRadius: "6px", // Reduce border radius
                      minWidth: "150px",
                    },
                  })
                }}
                disabled={isLoading}
              >
                {isLoading ? "Processing..." : "Save Contexts"}
              </Button>
            </header>
            {isLoading && (
              <div className="p-4 bg-gray-50">
                <Spinner
                  mode="context"
                  stage={processingStage}
                  text={processingStage === "consulting" ? "Analyzing files..." : "Saving the contexts..."}
                />
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleContextFileUpload}
              className="hidden"
              multiple
              accept=".pdf,.txt,.doc,.docx,.png,.jpg,.jpeg,.gif"
            />
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-500 transition-colors cursor-pointer my-4 mx-auto max-w-2xl"
              onClick={() => fileInputRef.current?.click()}
              onDrop={(e) => {
                e.preventDefault()
                const files = Array.from(e.dataTransfer.files)
                if (fileInputRef.current) {
                  const dataTransfer = new DataTransfer()
                  files.forEach((file) => dataTransfer.items.add(file))
                  fileInputRef.current.files = dataTransfer.files
                  handleContextFileUpload({ target: { files: dataTransfer.files } } as any)
                }
              }}
              onDragOver={(e) => e.preventDefault()}
            >
              <div className="flex flex-col items-center gap-2">
                <BookOpen className="h-8 w-8 text-gray-400" />
                <p className="text-gray-600 text-sm">Drag and drop files here, or click to select files</p>
                <p className="text-xs text-gray-500">Supports PDF, TXT, DOC, DOCX, PNG, JPG, GIF</p>
              </div>
            </div>

            {/* Display uploaded files */}

            {/* Display uploaded files */}
            <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h3 className="text-sm font-medium text-gray-700">Uploaded Files</h3>
              </div>
              <div className="max-h-[300px] overflow-y-auto pb-8">
                {getCurrentHistory()
                  .cases.find((c) => c.id === history.selectedCase)
                  ?.chats.find((chat) => chat.id === history.selectedChat)
                  ?.contextFiles?.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-white px-4 py-3 border-b border-gray-200 last:border-b-0"
                    >
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-purple-600 flex-shrink-0" />
                        <div className="flex flex-col">
                          <p className="text-sm font-medium text-gray-900 truncate" style={{ maxWidth: "200px" }}>
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => viewContextFile(file)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => {
                            setHistory((prev) => ({
                              ...prev,
                              cases: prev.cases.map((c) => {
                                if (c.id === history.selectedCase) {
                                  return {
                                    ...c,
                                    chats: c.chats.map((chat) => {
                                      if (chat.id === history.selectedChat) {
                                        return {
                                          ...chat,
                                          contextFiles: chat.contextFiles?.filter((_, i) => i !== index),
                                        }
                                      }
                                      return chat
                                    }),
                                  }
                                }
                                return c
                              }),
                            }))
                            toast.success("✅ File deleted", {
                              position: "top-center",
                              autoClose: 2000,
                              hideProgressBar: false,
                              closeOnClick: true,
                              pauseOnHover: true,
                              draggable: true,
                              progress: undefined,
                              style: {
                                backgroundColor: "#064e3b", // Dark green background
                                color: "#ffffff", // White text
                                fontSize: "12px", // Smaller font size
                                padding: "6px 10px", // Reduce padding
                                borderRadius: "6px", // Reduce border radius
                                minWidth: "150px",
                              },
                            })
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {currentMode !== "context" && (
          <div className="p-3 border-t bg-purple-50">
            {uploadedFile && (
              <div className="mb-4 flex items-center justify-between bg-gray-50 p-2 rounded-lg border">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">{uploadedFile.name}</span>
                  <span className="text-xs text-gray-400">{(uploadedFile.size / (1024 * 1024)).toFixed(2)}MB</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUploadedFile(null)}
                  className="h-6 w-6 p-0 hover:bg-gray-200"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex space-x-3">
              <Textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={`Enter your ${
                  currentMode === "research"
                    ? "research query"
                    : currentMode === "draft"
                      ? "draft requirements"
                      : "legal question"
                }...`}
                className="flex-1 bg-white text-black placeholder:text-gray-500 border-purple-200 focus:border-purple-400 min-h-[40px] max-h-[200px] resize-none overflow-y-auto"
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = "auto"
                  const newHeight = Math.min(target.scrollHeight, 200)
                  target.style.height = `${newHeight}px`

                  // If content exceeds max height, ensure scrolling works
                  if (target.scrollHeight > 200) {
                    target.style.overflowY = "auto"
                  } else {
                    target.style.overflowY = "hidden"
                  }
                }}
                rows={1}
                disabled={!getCurrentHistory().selectedChat}
              />
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
              <Button
                type="button"
                variant="outline"
                className="px-3"
                onClick={() => fileInputRef.current?.click()}
                disabled={!getCurrentHistory().selectedChat}
              >
                <Paperclip className="h-5 w-5" />
              </Button>
              <Button
                type="submit"
                className="bg-purple-600 hover:bg-purple-700"
                disabled={!getCurrentHistory().selectedChat}
              >
                <Send className="h-5 w-5 mr-2" />
                {!showEditor && <span>Send</span>}
              </Button>
            </form>
          </div>
        )}
      </div>
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <Card className="w-96">
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="font-semibold">
                    Username: <span className="font-normal">Aishik.D.Gupta</span>
                  </p>
                  <p className="font-semibold">
                    Email: <span className="font-normal">aishik11112010@gmail.com</span>
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button variant="destructive" className="flex-1">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </Button>
                  <Button variant="outline" onClick={() => setShowSettings(false)}>
                    <X className="mr-2 h-4 w-4" />
                    Close
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Auth Modal */}
      {showAuth && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <Card className="w-96">
            <CardHeader>
              <CardTitle>Login / Sign Up</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input type="email" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <Input type="password" required />
                </div>
                <div className="flex space-x-2">
                  <Button className="flex-1 bg-purple-600 hover:bg-purple-700">
                    <LogIn className="mr-2 h-4 w-4" />
                    Login
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Sign Up
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Rename Modal */}
      <Dialog open={!!renameItem} onOpenChange={() => setRenameItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {renameItem?.type}</DialogTitle>
            <DialogDescription>Enter a new name for this {renameItem?.type}</DialogDescription>
          </DialogHeader>
          <Input
            defaultValue={renameItem?.name}
            onChange={(e) => setRenameItem((prev) => (prev ? { ...prev, name: e.target.value } : null))}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameItem(null)}>
              Cancel
            </Button>
            <Button onClick={() => submitRename(renameItem?.name || "")}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Viewer Modal */}
      <Dialog open={fileViewerModal.open} onOpenChange={(open) => setFileViewerModal((prev) => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-[900px]">
          <DialogHeader>
            <DialogTitle>File Preview</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4"
              onClick={() => setFileViewerModal({ open: false, content: null, type: "" })}
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>
          {fileViewerModal.content &&
            (fileViewerModal.type.startsWith("image/") ? (
              <img
                src={fileViewerModal.content || "/placeholder.svg"}
                alt="Preview"
                className="max-h-[80vh] w-auto mx-auto object-contain"
              />
            ) : fileViewerModal.type === "application/pdf" ? (
              <object data={fileViewerModal.content} type="application/pdf" className="w-full h-[80vh]">
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                  <FileText className="h-12 w-12 text-gray-400" />
                  <p className="text-gray-600">Click to Open File.</p>
                  <Button variant="outline" onClick={() => window.open(fileViewerModal.content || "", "_blank")}>
                    Open PDF
                  </Button>
                </div>
              </object>
            ) : (
              <div className="p-4 text-center">File preview not available</div>
            ))}
        </DialogContent>
      </Dialog>

      {/* Download Filename Modal */}
      <Dialog
        open={isDownloadModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsDownloadModalOpen(false)
            setDownloadDetails(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Save Document</DialogTitle>
            <DialogDescription>
              Enter a filename for your {downloadDetails?.format.toUpperCase()} document.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="filename" className="text-right font-medium col-span-1">
                Filename
              </label>
              <div className="col-span-3 flex">
                <Input
                  id="filename"
                  value={downloadDetails?.fileName || ""}
                  onChange={(e) => setDownloadDetails((prev) => (prev ? { ...prev, fileName: e.target.value } : null))}
                  className="flex-1"
                  autoFocus
                />
                <span className="ml-2 flex items-center text-sm text-gray-500">.{downloadDetails?.format}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDownloadModalOpen(false)
                setDownloadDetails(null)
              }}
            >
              Cancel
            </Button>
            <Button onClick={processDownload} type="submit">
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default LegalThinkAI

