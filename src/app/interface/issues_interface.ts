import { commentResponseDTO } from "./comment_interface"
import { UserInfo } from "./user_interface"

export interface IssuesResponseDTO {
  id: string,
  scanId: string,
  projectId?: string,
  projectData?: {
    id: string,
    name: string
  },
  issueKey: string,
  type: string,
  severity: string,
  ruleKey: string,
  component: string,
  line: number,
  message: string,
  assignedTo?: {
    id: string,
    username: string,
    email: string,
    role: string,
    phone: string,
    createAt: string
  },
  status?: string | null,
  createdAt: string,
  commentData: commentResponseDTO[]
}

  export interface IssuesRequestDTO {
    id: string,
    status?: string | null,
    assignedTo?: string | null;
  }
    export interface IssuesDetailResponseDTO {
    description: string,
    vulnerableCode: string,
    recommendedFix: string  
  }
  
