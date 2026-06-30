import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class StudentProjectsQueryDto extends PaginationQueryDto {
  search?: string;
  roleId?: string;
  programKey?: string;
}

export type StudentProjectTaskDto = {
  title: string;
  description?: string;
};

export type StudentProjectDocumentDto = {
  title: string;
  link?: string;
  type?: string;
  description?: string;
};

export type StudentProjectDeliverableDto = {
  title: string;
  format?: string;
  note?: string;
};

export class StudentProjectListItemDto {
  id!: string;
  roleId?: string;
  projectRole?: string;
  companyName?: string;
  programKey?: string;
  programKeys!: string[];
  programName?: string;
  title!: string;
  brief?: string;
  objectives?: string;
  tasks!: StudentProjectTaskDto[];
  documents!: StudentProjectDocumentDto[];
  deliverables!: StudentProjectDeliverableDto[];
  submissionLink?: string;
  deadline?: string;
  updatedAt?: string;
}
