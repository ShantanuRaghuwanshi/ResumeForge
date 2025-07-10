import { ParsedResume, AnalysisResult } from "@shared/schema";
import { LLMService } from "./llm";

export class ResumeAnalyzer {
  constructor(private llmService: LLMService) {}

  async analyzeResume(parsedResume: ParsedResume): Promise<AnalysisResult> {
    try {
      const analysis = await this.llmService.analyzeResume(parsedResume);
      
      // Add additional analysis logic here
      const enhancedAnalysis = this.enhanceAnalysis(analysis, parsedResume);
      
      return enhancedAnalysis;
    } catch (error) {
      throw new Error(`Failed to analyze resume: ${error.message}`);
    }
  }

  async analyzeJobMatch(parsedResume: ParsedResume, jobDescription: string): Promise<AnalysisResult> {
    try {
      const analysis = await this.llmService.analyzeJobMatch(parsedResume, jobDescription);
      
      // Add job-specific analysis enhancements
      const enhancedAnalysis = this.enhanceJobMatchAnalysis(analysis, parsedResume, jobDescription);
      
      return enhancedAnalysis;
    } catch (error) {
      throw new Error(`Failed to analyze job match: ${error.message}`);
    }
  }

  private enhanceAnalysis(analysis: AnalysisResult, parsedResume: ParsedResume): AnalysisResult {
    const suggestions = [...(analysis.suggestions || [])];
    
    // Check for missing contact information
    if (!parsedResume.personalDetails?.email) {
      suggestions.push({
        type: "warning",
        title: "Missing Email",
        description: "Add a professional email address to your contact information",
        section: "personalDetails",
      });
    }
    
    if (!parsedResume.personalDetails?.phone) {
      suggestions.push({
        type: "warning",
        title: "Missing Phone Number",
        description: "Include a phone number for recruiters to contact you",
        section: "personalDetails",
      });
    }

    // Check for experience descriptions
    if (parsedResume.experience?.some(exp => !exp.description || exp.description.length < 50)) {
      suggestions.push({
        type: "info",
        title: "Expand Experience Descriptions",
        description: "Add more detailed descriptions of your accomplishments and responsibilities",
        section: "experience",
      });
    }

    // Check for quantifiable achievements
    const hasQuantifiableAchievements = parsedResume.experience?.some(exp => 
      /\d+%|\d+\$|\d+,\d+|\d+ years?|\d+ months?/i.test(exp.description || "")
    );
    
    if (!hasQuantifiableAchievements) {
      suggestions.push({
        type: "warning",
        title: "Add Quantifiable Achievements",
        description: "Include specific numbers, percentages, or metrics to demonstrate your impact",
        section: "experience",
      });
    }

    return {
      ...analysis,
      suggestions,
      score: this.calculateScore(parsedResume, suggestions),
    };
  }

  private enhanceJobMatchAnalysis(
    analysis: AnalysisResult,
    parsedResume: ParsedResume,
    jobDescription: string
  ): AnalysisResult {
    const jobKeywords = this.extractKeywords(jobDescription);
    const resumeText = JSON.stringify(parsedResume).toLowerCase();
    
    const missingKeywords = jobKeywords.filter(
      keyword => !resumeText.includes(keyword.toLowerCase())
    );
    
    const suggestions = [...(analysis.suggestions || [])];
    
    if (missingKeywords.length > 0) {
      suggestions.push({
        type: "warning",
        title: "Missing Key Skills",
        description: `Consider adding these relevant skills: ${missingKeywords.slice(0, 5).join(", ")}`,
        section: "skills",
      });
    }

    return {
      ...analysis,
      suggestions,
      keywords: [...(analysis.keywords || []), ...missingKeywords],
    };
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction - in a real app, you'd use more sophisticated NLP
    const commonSkills = [
      "JavaScript", "TypeScript", "React", "Node.js", "Python", "Java", "AWS", "Docker",
      "Kubernetes", "SQL", "MongoDB", "PostgreSQL", "Git", "Agile", "Scrum",
      "Machine Learning", "Data Analysis", "Project Management", "Leadership",
      "Communication", "Problem Solving", "Team Collaboration"
    ];
    
    return commonSkills.filter(skill => 
      text.toLowerCase().includes(skill.toLowerCase())
    );
  }

  private calculateScore(parsedResume: ParsedResume, suggestions: any[]): number {
    let score = 100;
    
    // Deduct points for warnings
    const warnings = suggestions.filter(s => s.type === "warning");
    score -= warnings.length * 5;
    
    // Deduct points for missing sections
    if (!parsedResume.personalDetails?.name) score -= 10;
    if (!parsedResume.experience?.length) score -= 20;
    if (!parsedResume.education?.length) score -= 10;
    if (!parsedResume.skills?.technical?.length) score -= 15;
    
    return Math.max(0, Math.min(100, score));
  }
}
