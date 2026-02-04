import { commentResponseDTO } from "./comment_interface"
import { UserInfo } from "./user_interface"

export interface IssuesResponseDTO {
    id: string,
    scanId: string,
    projectData: {
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
    assignedTo: {
    id: string,
    username: string,
    email: string,
    role: string,
    phone: string,
    createAt: string
    },
    status: string,
    createdAt: string,
    commentData:  commentResponseDTO[]
  }

  export interface IssuesRequestDTO {
    id: string,
    status: string,
    assignedTo: string
  }
    export interface IssuesDetailResponseDTO {
    description: string,
    vulnerableCode: string,
    recommendedFix: string  
  }
  