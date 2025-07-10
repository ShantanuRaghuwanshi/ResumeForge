import { 
  users, resumes, llmConfigs, jobDescriptions,
  type User, type InsertUser, type Resume, type InsertResume,
  type LLMConfig, type InsertLLMConfig, type JobDescription, type InsertJobDescription
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Resume operations
  createResume(resume: InsertResume): Promise<Resume>;
  getResume(id: number): Promise<Resume | undefined>;
  getResumesByUserId(userId: number): Promise<Resume[]>;
  updateResume(id: number, updates: Partial<Resume>): Promise<Resume>;
  deleteResume(id: number): Promise<void>;

  // LLM Config operations
  createLLMConfig(config: InsertLLMConfig): Promise<LLMConfig>;
  getLLMConfigsByUserId(userId: number): Promise<LLMConfig[]>;
  getActiveLLMConfig(userId: number): Promise<LLMConfig | undefined>;
  updateLLMConfig(id: number, updates: Partial<LLMConfig>): Promise<LLMConfig>;
  deleteLLMConfig(id: number): Promise<void>;

  // Job Description operations
  createJobDescription(jobDesc: InsertJobDescription): Promise<JobDescription>;
  getJobDescriptionsByResumeId(resumeId: number): Promise<JobDescription[]>;
  updateJobDescription(id: number, updates: Partial<JobDescription>): Promise<JobDescription>;
  deleteJobDescription(id: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private resumes: Map<number, Resume>;
  private llmConfigs: Map<number, LLMConfig>;
  private jobDescriptions: Map<number, JobDescription>;
  private currentUserId: number;
  private currentResumeId: number;
  private currentLLMConfigId: number;
  private currentJobDescId: number;

  constructor() {
    this.users = new Map();
    this.resumes = new Map();
    this.llmConfigs = new Map();
    this.jobDescriptions = new Map();
    this.currentUserId = 1;
    this.currentResumeId = 1;
    this.currentLLMConfigId = 1;
    this.currentJobDescId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createResume(insertResume: InsertResume): Promise<Resume> {
    const id = this.currentResumeId++;
    const resume: Resume = { 
      ...insertResume, 
      id,
      userId: insertResume.userId || null,
      parsedData: insertResume.parsedData || null,
      analysisResults: insertResume.analysisResults || null,
      selectedTemplate: insertResume.selectedTemplate || null,
      finalContent: insertResume.finalContent || null,
      createdAt: new Date(),
    };
    this.resumes.set(id, resume);
    return resume;
  }

  async getResume(id: number): Promise<Resume | undefined> {
    return this.resumes.get(id);
  }

  async getResumesByUserId(userId: number): Promise<Resume[]> {
    return Array.from(this.resumes.values()).filter(
      (resume) => resume.userId === userId,
    );
  }

  async updateResume(id: number, updates: Partial<Resume>): Promise<Resume> {
    const existing = this.resumes.get(id);
    if (!existing) {
      throw new Error(`Resume with id ${id} not found`);
    }
    const updated = { ...existing, ...updates };
    this.resumes.set(id, updated);
    return updated;
  }

  async deleteResume(id: number): Promise<void> {
    this.resumes.delete(id);
  }

  async createLLMConfig(insertConfig: InsertLLMConfig): Promise<LLMConfig> {
    const id = this.currentLLMConfigId++;
    const config: LLMConfig = { 
      ...insertConfig, 
      id,
      userId: insertConfig.userId || null,
      isActive: insertConfig.isActive || null,
    };
    this.llmConfigs.set(id, config);
    return config;
  }

  async getLLMConfigsByUserId(userId: number): Promise<LLMConfig[]> {
    return Array.from(this.llmConfigs.values()).filter(
      (config) => config.userId === userId,
    );
  }

  async getActiveLLMConfig(userId: number): Promise<LLMConfig | undefined> {
    return Array.from(this.llmConfigs.values()).find(
      (config) => config.userId === userId && config.isActive,
    );
  }

  async updateLLMConfig(id: number, updates: Partial<LLMConfig>): Promise<LLMConfig> {
    const existing = this.llmConfigs.get(id);
    if (!existing) {
      throw new Error(`LLM Config with id ${id} not found`);
    }
    const updated = { ...existing, ...updates };
    this.llmConfigs.set(id, updated);
    return updated;
  }

  async deleteLLMConfig(id: number): Promise<void> {
    this.llmConfigs.delete(id);
  }

  async createJobDescription(insertJobDesc: InsertJobDescription): Promise<JobDescription> {
    const id = this.currentJobDescId++;
    const jobDesc: JobDescription = { 
      ...insertJobDesc, 
      id,
      resumeId: insertJobDesc.resumeId || null,
      matchAnalysis: insertJobDesc.matchAnalysis || null,
      createdAt: new Date(),
    };
    this.jobDescriptions.set(id, jobDesc);
    return jobDesc;
  }

  async getJobDescriptionsByResumeId(resumeId: number): Promise<JobDescription[]> {
    return Array.from(this.jobDescriptions.values()).filter(
      (jobDesc) => jobDesc.resumeId === resumeId,
    );
  }

  async updateJobDescription(id: number, updates: Partial<JobDescription>): Promise<JobDescription> {
    const existing = this.jobDescriptions.get(id);
    if (!existing) {
      throw new Error(`Job Description with id ${id} not found`);
    }
    const updated = { ...existing, ...updates };
    this.jobDescriptions.set(id, updated);
    return updated;
  }

  async deleteJobDescription(id: number): Promise<void> {
    this.jobDescriptions.delete(id);
  }
}

export const storage = new MemStorage();
