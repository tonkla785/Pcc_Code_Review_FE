import { UserInfo } from "./user_interface";

  export interface commentRequestDTO {
  issueId?: string;
  userId?: string;
  comment?: string;
  }
    export interface commentResponseDTO {
        id: string,
        issue: string,
        user:UserInfo,
        comment: string,
        createdAt: string
  }