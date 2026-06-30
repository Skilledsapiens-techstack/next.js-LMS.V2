import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export type AdminProjectStatus = 'active' | 'inactive';

export class AdminProjectsQueryDto extends PaginationQueryDto {
  search?: string;
  status: AdminProjectStatus | 'all' = 'all';
  roleId?: string;
  programKey?: string;
}

export type AdminProjectTaskDto = {
  title: string;
  description?: string;
};

export type AdminProjectDocumentDto = {
  title: string;
  link?: string;
  type?: string;
  description?: string;
};

export type AdminProjectDeliverableDto = {
  title: string;
  format?: string;
  note?: string;
};

export class AdminProjectListItemDto {
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
  tasks!: AdminProjectTaskDto[];
  documents!: AdminProjectDocumentDto[];
  deliverables!: AdminProjectDeliverableDto[];
  submissionLink?: string;
  deadline?: string;
  status!: AdminProjectStatus;
  updatedAt?: string;
}
