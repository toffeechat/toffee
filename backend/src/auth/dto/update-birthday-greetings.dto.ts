import { IsBoolean } from 'class-validator';

export class UpdateBirthdayGreetingsDto {
  @IsBoolean()
  enabled!: boolean;
}
