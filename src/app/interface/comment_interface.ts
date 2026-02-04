import { UserInfo } from "./user_interface";

  export interface commentRequestDTO {
  issueId?: string;
  userId?: string;
  comment?: string;
  parentCommentId?: string;
  }
    export interface commentResponseDTO {
        id: string,
        issue: string,
        user:UserInfo,
        comment: string,
        createdAt: string
        parentCommentId?: string;
        
  }