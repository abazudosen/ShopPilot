import { Module } from "@nestjs/common";
import { OutboxService } from "./outbox.service";
import { EmailService } from "./email.service";

@Module({
  providers: [OutboxService, EmailService],
})
export class OutboxModule {}
