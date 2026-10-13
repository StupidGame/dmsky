/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class DiscordLogin1791930385948 {
	name = 'DiscordLogin1791930385948';

	async up(queryRunner) {
		await queryRunner.query('ALTER TABLE "user_profile" ADD "discordId" character varying(32)');
		await queryRunner.query('CREATE UNIQUE INDEX "IDX_user_profile_discordId" ON "user_profile" ("discordId")');
	}

	async down(queryRunner) {
		await queryRunner.query('DROP INDEX "IDX_user_profile_discordId"');
		await queryRunner.query('ALTER TABLE "user_profile" DROP COLUMN "discordId"');
	}
}
