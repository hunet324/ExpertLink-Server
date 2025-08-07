import { IsNotEmpty, IsNumber } from 'class-validator';

export class ContentInteractionDto {
  @IsNotEmpty()
  @IsNumber()
  contentId: number;
}

export class ContentLikeResponseDto {
  message: string;
  isLiked: boolean;
  likeCount: number;
}

export class ContentBookmarkResponseDto {
  message: string;
  isBookmarked: boolean;
  bookmarkCount: number;
}