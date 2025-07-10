import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { LLMConfig, ParsedResume, AnalysisResult } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const DEFAULT_OPENAI_MODEL = "gpt-4o";
// The newest Anthropic model is "claude-sonnet-4-20250514", not "claude-3-7-sonnet-20250219", "claude-3-5-sonnet-20241022" nor "claude-3-sonnet-20240229".
const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-20250514";
// Note that the newest Gemini model series is "gemini-2.5-flash" or gemini-2.5-pro"
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export interface LLMService {
  parseResume(text: string): Promise<ParsedResume>;
  analyzeResume(parsedResume: ParsedResume): Promise<AnalysisResult>;
  analyzeJobMatch(parsedResume: ParsedResume, jobDescription: string): Promise<AnalysisResult>;
}

export class OpenAIService implements LLMService {
  private client: OpenAI;

  constructor(config: Record<string, string>) {
    this.client = new OpenAI({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      organization: config.organizationId,
    });
  }

  async parseResume(text: string): Promise<ParsedResume> {
    const response = await this.client.chat.completions.create({
      model: DEFAULT_OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a resume parsing expert. Extract structured data from the resume text and return it in JSON format with these fields:
          - personalDetails: {name, email, phone, location, summary}
          - experience: [{title, company, duration, description, achievements}]
          - education: [{degree, institution, year, gpa}]
          - skills: {technical, soft, languages}
          - projects: [{name, description, technologies}]
          
          Return only valid JSON without any additional text.`
        },
        {
          role: "user",
          content: `Parse this resume:\n\n${text}`
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result;
  }

  async analyzeResume(parsedResume: ParsedResume): Promise<AnalysisResult> {
    const response = await this.client.chat.completions.create({
      model: DEFAULT_OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a resume analysis expert. Analyze the resume and provide:
          - score: Overall score 0-100
          - suggestions: Array of {type: "warning"|"info"|"success", title, description, section}
          - keywords: Important keywords found
          - atsCompatibility: ATS compatibility score 0-100
          
          Focus on industry standards, formatting, content quality, and ATS compatibility.
          Return only valid JSON.`
        },
        {
          role: "user",
          content: `Analyze this parsed resume data:\n\n${JSON.stringify(parsedResume, null, 2)}`
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result;
  }

  async analyzeJobMatch(parsedResume: ParsedResume, jobDescription: string): Promise<AnalysisResult> {
    const response = await this.client.chat.completions.create({
      model: DEFAULT_OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a job matching expert. Compare the resume against the job description and provide:
          - score: Match score 0-100
          - suggestions: Specific improvements to match the job better
          - keywords: Missing keywords from the job description
          - atsCompatibility: How well the resume would perform in ATS for this job
          
          Return only valid JSON.`
        },
        {
          role: "user",
          content: `Resume:\n${JSON.stringify(parsedResume, null, 2)}\n\nJob Description:\n${jobDescription}`
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result;
  }
}

export class ClaudeService implements LLMService {
  private client: Anthropic;

  constructor(config: Record<string, string>) {
    this.client = new Anthropic({
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  async parseResume(text: string): Promise<ParsedResume> {
    const response = await this.client.messages.create({
      model: DEFAULT_CLAUDE_MODEL,
      max_tokens: 2048,
      system: `You are a resume parsing expert. Extract structured data from the resume text and return it in JSON format with these fields:
      - personalDetails: {name, email, phone, location, summary}
      - experience: [{title, company, duration, description, achievements}]
      - education: [{degree, institution, year, gpa}]
      - skills: {technical, soft, languages}
      - projects: [{name, description, technologies}]
      
      Return only valid JSON without any additional text.`,
      messages: [
        {
          role: "user",
          content: `Parse this resume:\n\n${text}`
        }
      ],
    });

    const result = JSON.parse(response.content[0].text);
    return result;
  }

  async analyzeResume(parsedResume: ParsedResume): Promise<AnalysisResult> {
    const response = await this.client.messages.create({
      model: DEFAULT_CLAUDE_MODEL,
      max_tokens: 2048,
      system: `You are a resume analysis expert. Analyze the resume and provide JSON with:
      - score: Overall score 0-100
      - suggestions: Array of {type: "warning"|"info"|"success", title, description, section}
      - keywords: Important keywords found
      - atsCompatibility: ATS compatibility score 0-100
      
      Focus on industry standards, formatting, content quality, and ATS compatibility.`,
      messages: [
        {
          role: "user",
          content: `Analyze this parsed resume data:\n\n${JSON.stringify(parsedResume, null, 2)}`
        }
      ],
    });

    const result = JSON.parse(response.content[0].text);
    return result;
  }

  async analyzeJobMatch(parsedResume: ParsedResume, jobDescription: string): Promise<AnalysisResult> {
    const response = await this.client.messages.create({
      model: DEFAULT_CLAUDE_MODEL,
      max_tokens: 2048,
      system: `You are a job matching expert. Compare the resume against the job description and provide JSON with:
      - score: Match score 0-100
      - suggestions: Specific improvements to match the job better
      - keywords: Missing keywords from the job description
      - atsCompatibility: How well the resume would perform in ATS for this job`,
      messages: [
        {
          role: "user",
          content: `Resume:\n${JSON.stringify(parsedResume, null, 2)}\n\nJob Description:\n${jobDescription}`
        }
      ],
    });

    const result = JSON.parse(response.content[0].text);
    return result;
  }
}

export class GeminiService implements LLMService {
  private client: GoogleGenAI;

  constructor(config: Record<string, string>) {
    this.client = new GoogleGenAI({
      apiKey: config.apiKey || process.env.GEMINI_API_KEY,
    });
  }

  async parseResume(text: string): Promise<ParsedResume> {
    const response = await this.client.models.generateContent({
      model: DEFAULT_GEMINI_MODEL,
      config: {
        systemInstruction: `You are a resume parsing expert. Extract structured data from the resume text and return it in JSON format with these fields:
        - personalDetails: {name, email, phone, location, summary}
        - experience: [{title, company, duration, description, achievements}]
        - education: [{degree, institution, year, gpa}]
        - skills: {technical, soft, languages}
        - projects: [{name, description, technologies}]`,
        responseMimeType: "application/json",
      },
      contents: `Parse this resume:\n\n${text}`,
    });

    const result = JSON.parse(response.text || "{}");
    return result;
  }

  async analyzeResume(parsedResume: ParsedResume): Promise<AnalysisResult> {
    const response = await this.client.models.generateContent({
      model: DEFAULT_GEMINI_MODEL,
      config: {
        systemInstruction: `You are a resume analysis expert. Analyze the resume and provide:
        - score: Overall score 0-100
        - suggestions: Array of {type: "warning"|"info"|"success", title, description, section}
        - keywords: Important keywords found
        - atsCompatibility: ATS compatibility score 0-100
        
        Focus on industry standards, formatting, content quality, and ATS compatibility.`,
        responseMimeType: "application/json",
      },
      contents: `Analyze this parsed resume data:\n\n${JSON.stringify(parsedResume, null, 2)}`,
    });

    const result = JSON.parse(response.text || "{}");
    return result;
  }

  async analyzeJobMatch(parsedResume: ParsedResume, jobDescription: string): Promise<AnalysisResult> {
    const response = await this.client.models.generateContent({
      model: DEFAULT_GEMINI_MODEL,
      config: {
        systemInstruction: `You are a job matching expert. Compare the resume against the job description and provide:
        - score: Match score 0-100
        - suggestions: Specific improvements to match the job better
        - keywords: Missing keywords from the job description
        - atsCompatibility: How well the resume would perform in ATS for this job`,
        responseMimeType: "application/json",
      },
      contents: `Resume:\n${JSON.stringify(parsedResume, null, 2)}\n\nJob Description:\n${jobDescription}`,
    });

    const result = JSON.parse(response.text || "{}");
    return result;
  }
}

export class OllamaService implements LLMService {
  private baseUrl: string;
  private model: string;

  constructor(config: Record<string, string>) {
    this.baseUrl = config.url || "http://localhost:11434";
    this.model = config.model || "llama2";
  }

  private async makeRequest(prompt: string, system?: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        prompt,
        system,
        stream: false,
        format: "json",
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
  }

  async parseResume(text: string): Promise<ParsedResume> {
    const system = `You are a resume parsing expert. Extract structured data from the resume text and return it in JSON format with these fields:
    - personalDetails: {name, email, phone, location, summary}
    - experience: [{title, company, duration, description, achievements}]
    - education: [{degree, institution, year, gpa}]
    - skills: {technical, soft, languages}
    - projects: [{name, description, technologies}]
    
    Return only valid JSON without any additional text.`;

    const response = await this.makeRequest(`Parse this resume:\n\n${text}`, system);
    const result = JSON.parse(response);
    return result;
  }

  async analyzeResume(parsedResume: ParsedResume): Promise<AnalysisResult> {
    const system = `You are a resume analysis expert. Analyze the resume and provide JSON with:
    - score: Overall score 0-100
    - suggestions: Array of {type: "warning"|"info"|"success", title, description, section}
    - keywords: Important keywords found
    - atsCompatibility: ATS compatibility score 0-100
    
    Focus on industry standards, formatting, content quality, and ATS compatibility.`;

    const response = await this.makeRequest(
      `Analyze this parsed resume data:\n\n${JSON.stringify(parsedResume, null, 2)}`,
      system
    );
    const result = JSON.parse(response);
    return result;
  }

  async analyzeJobMatch(parsedResume: ParsedResume, jobDescription: string): Promise<AnalysisResult> {
    const system = `You are a job matching expert. Compare the resume against the job description and provide JSON with:
    - score: Match score 0-100
    - suggestions: Specific improvements to match the job better
    - keywords: Missing keywords from the job description
    - atsCompatibility: How well the resume would perform in ATS for this job`;

    const response = await this.makeRequest(
      `Resume:\n${JSON.stringify(parsedResume, null, 2)}\n\nJob Description:\n${jobDescription}`,
      system
    );
    const result = JSON.parse(response);
    return result;
  }
}

export function createLLMService(config: LLMConfig): LLMService {
  switch (config.provider) {
    case "openai":
      return new OpenAIService(config.config as Record<string, string>);
    case "claude":
      return new ClaudeService(config.config as Record<string, string>);
    case "gemini":
      return new GeminiService(config.config as Record<string, string>);
    case "ollama":
      return new OllamaService(config.config as Record<string, string>);
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}
