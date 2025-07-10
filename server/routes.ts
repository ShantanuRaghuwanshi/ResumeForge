import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { parseFile, validateFileType, validateFileSize } from "./services/parser";
import { createLLMService } from "./services/llm";
import { ResumeAnalyzer } from "./services/analyzer";
import { 
  fileUploadSchema, 
  llmProviderConfigSchema, 
  insertResumeSchema, 
  insertLLMConfigSchema,
  insertJobDescriptionSchema,
  parsedResumeSchema 
} from "@shared/schema";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Test LLM connection
  app.post("/api/llm/test", async (req, res) => {
    try {
      const { provider, config } = llmProviderConfigSchema.parse(req.body);
      
      const llmConfig = {
        id: 0,
        userId: 1, // Mock user ID for testing
        provider,
        config,
        isActive: false,
      };
      
      const llmService = createLLMService(llmConfig);
      
      // Test with a simple parsing request
      const testResume = "John Doe\nSoftware Engineer\njohn@example.com\n+1234567890";
      const result = await llmService.parseResume(testResume);
      
      res.json({ success: true, message: "LLM connection successful", result });
    } catch (error) {
      res.status(400).json({ 
        success: false, 
        message: `LLM connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  });

  // Save LLM configuration
  app.post("/api/llm/config", async (req, res) => {
    try {
      const configData = insertLLMConfigSchema.parse(req.body);
      
      // Deactivate other configs for this user
      const existingConfigs = await storage.getLLMConfigsByUserId(configData.userId || 1);
      for (const config of existingConfigs) {
        await storage.updateLLMConfig(config.id, { isActive: false });
      }
      
      // Create new active config
      const newConfig = await storage.createLLMConfig({
        ...configData,
        isActive: true,
      });
      
      res.json(newConfig);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Get active LLM configuration
  app.get("/api/llm/config", async (req, res) => {
    try {
      const userId = 1; // Mock user ID
      const config = await storage.getActiveLLMConfig(userId);
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Upload and parse resume
  app.post("/api/resume/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { buffer, originalname, mimetype, size } = req.file;

      if (!validateFileType(mimetype)) {
        return res.status(400).json({ 
          message: "Unsupported file type. Please upload PDF, DOC, or DOCX files." 
        });
      }

      if (!validateFileSize(size)) {
        return res.status(400).json({ 
          message: "File too large. Maximum size is 10MB." 
        });
      }

      // Parse the file
      const parsedFile = await parseFile(buffer, originalname, mimetype);
      
      // Get active LLM config
      const userId = 1; // Mock user ID
      const llmConfig = await storage.getActiveLLMConfig(userId);
      
      if (!llmConfig) {
        return res.status(400).json({ 
          message: "No LLM configuration found. Please configure an LLM first." 
        });
      }

      // Parse resume with LLM
      const llmService = createLLMService(llmConfig);
      const parsedData = await llmService.parseResume(parsedFile.text);

      // Create resume record
      const resume = await storage.createResume({
        userId,
        filename: originalname,
        originalContent: parsedFile.text,
        parsedData,
        analysisResults: null,
        selectedTemplate: null,
        finalContent: null,
      });

      res.json({
        resumeId: resume.id,
        filename: originalname,
        parsedData,
        metadata: parsedFile.metadata,
      });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Analyze resume
  app.post("/api/resume/:id/analyze", async (req, res) => {
    try {
      const resumeId = parseInt(req.params.id);
      const resume = await storage.getResume(resumeId);
      
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }

      if (!resume.parsedData) {
        return res.status(400).json({ message: "Resume not parsed yet" });
      }

      // Get active LLM config
      const llmConfig = await storage.getActiveLLMConfig(resume.userId || 1);
      
      if (!llmConfig) {
        return res.status(400).json({ 
          message: "No LLM configuration found" 
        });
      }

      // Analyze resume
      const llmService = createLLMService(llmConfig);
      const analyzer = new ResumeAnalyzer(llmService);
      const analysisResults = await analyzer.analyzeResume(resume.parsedData);

      // Update resume with analysis
      const updatedResume = await storage.updateResume(resumeId, {
        analysisResults,
      });

      res.json(analysisResults);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Update parsed resume data
  app.put("/api/resume/:id/data", async (req, res) => {
    try {
      const resumeId = parseInt(req.params.id);
      const parsedData = parsedResumeSchema.parse(req.body);
      
      const updatedResume = await storage.updateResume(resumeId, {
        parsedData,
      });

      res.json(updatedResume);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Analyze job match
  app.post("/api/resume/:id/job-match", async (req, res) => {
    try {
      const resumeId = parseInt(req.params.id);
      const { jobDescription } = req.body;
      
      if (!jobDescription || typeof jobDescription !== "string") {
        return res.status(400).json({ message: "Job description is required" });
      }

      const resume = await storage.getResume(resumeId);
      
      if (!resume || !resume.parsedData) {
        return res.status(404).json({ message: "Resume not found or not parsed" });
      }

      // Get active LLM config
      const llmConfig = await storage.getActiveLLMConfig(resume.userId || 1);
      
      if (!llmConfig) {
        return res.status(400).json({ 
          message: "No LLM configuration found" 
        });
      }

      // Analyze job match
      const llmService = createLLMService(llmConfig);
      const analyzer = new ResumeAnalyzer(llmService);
      const matchAnalysis = await analyzer.analyzeJobMatch(resume.parsedData, jobDescription);

      // Save job description and analysis
      const jobDesc = await storage.createJobDescription({
        resumeId,
        content: jobDescription,
        matchAnalysis,
      });

      res.json(matchAnalysis);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Get resume data
  app.get("/api/resume/:id", async (req, res) => {
    try {
      const resumeId = parseInt(req.params.id);
      const resume = await storage.getResume(resumeId);
      
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }

      res.json(resume);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Get user resumes
  app.get("/api/resumes", async (req, res) => {
    try {
      const userId = 1; // Mock user ID
      const resumes = await storage.getResumesByUserId(userId);
      res.json(resumes);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Apply template to resume
  app.post("/api/resume/:id/template", async (req, res) => {
    try {
      const resumeId = parseInt(req.params.id);
      const { templateId } = req.body;
      
      if (!templateId) {
        return res.status(400).json({ message: "Template ID is required" });
      }

      const resume = await storage.getResume(resumeId);
      
      if (!resume || !resume.parsedData) {
        return res.status(404).json({ message: "Resume not found or not parsed" });
      }

      // Generate final content based on template
      const finalContent = generateResumeContent(resume.parsedData, templateId);

      const updatedResume = await storage.updateResume(resumeId, {
        selectedTemplate: templateId,
        finalContent,
      });

      res.json({ 
        templateId, 
        finalContent,
        preview: generatePreviewHtml(resume.parsedData, templateId)
      });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Generate download
  app.get("/api/resume/:id/download/:format", async (req, res) => {
    try {
      const resumeId = parseInt(req.params.id);
      const format = req.params.format;
      
      const resume = await storage.getResume(resumeId);
      
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }

      const content = resume.finalContent || generateResumeContent(
        resume.parsedData, 
        resume.selectedTemplate || "modern"
      );

      switch (format) {
        case "pdf":
          // In a real app, you'd generate a PDF using a library like puppeteer
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", `attachment; filename="${resume.filename}.pdf"`);
          res.send(Buffer.from(content));
          break;
        case "docx":
          // In a real app, you'd generate a DOCX using a library like docx
          res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
          res.setHeader("Content-Disposition", `attachment; filename="${resume.filename}.docx"`);
          res.send(Buffer.from(content));
          break;
        case "txt":
          res.setHeader("Content-Type", "text/plain");
          res.setHeader("Content-Disposition", `attachment; filename="${resume.filename}.txt"`);
          res.send(content);
          break;
        default:
          res.status(400).json({ message: "Unsupported format" });
      }
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

function generateResumeContent(parsedData: any, templateId: string): string {
  // Simple text generation - in a real app, you'd use proper templating
  const { personalDetails, experience, education, skills, projects } = parsedData;
  
  let content = "";
  
  if (personalDetails) {
    content += `${personalDetails.name || ""}\n`;
    content += `${personalDetails.email || ""} | ${personalDetails.phone || ""}\n`;
    content += `${personalDetails.location || ""}\n\n`;
    
    if (personalDetails.summary) {
      content += `PROFESSIONAL SUMMARY\n${personalDetails.summary}\n\n`;
    }
  }
  
  if (experience?.length) {
    content += "WORK EXPERIENCE\n";
    experience.forEach((exp: any) => {
      content += `${exp.title} at ${exp.company} (${exp.duration})\n`;
      content += `${exp.description}\n`;
      if (exp.achievements?.length) {
        exp.achievements.forEach((achievement: string) => {
          content += `• ${achievement}\n`;
        });
      }
      content += "\n";
    });
  }
  
  if (education?.length) {
    content += "EDUCATION\n";
    education.forEach((edu: any) => {
      content += `${edu.degree} - ${edu.institution} (${edu.year})\n`;
    });
    content += "\n";
  }
  
  if (skills?.technical?.length) {
    content += "TECHNICAL SKILLS\n";
    content += skills.technical.join(", ") + "\n\n";
  }
  
  if (projects?.length) {
    content += "PROJECTS\n";
    projects.forEach((project: any) => {
      content += `${project.name}\n`;
      content += `${project.description}\n`;
      if (project.technologies?.length) {
        content += `Technologies: ${project.technologies.join(", ")}\n`;
      }
      content += "\n";
    });
  }
  
  return content;
}

function generatePreviewHtml(parsedData: any, templateId: string): string {
  const content = generateResumeContent(parsedData, templateId);
  return `<pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">${content}</pre>`;
}
