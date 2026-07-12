<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('backup_targets', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('driver');
            $table->json('config');
            $table->boolean('enabled')->default(true);
            $table->timestamps();
        });

        Schema::table('backups', function (Blueprint $table) {
            $table->string('checksum')->nullable()->after('size');
            $table->timestamp('verified_at')->nullable()->after('checksum');
            $table->string('restore_status')->nullable()->after('verified_at');
            $table->string('snapshot_id')->nullable()->after('restore_status');
            $table->foreignId('target_id')->nullable()->after('snapshot_id')->constrained('backup_targets')->nullOnDelete();
        });

        Schema::table('backup_schedules', function (Blueprint $table) {
            $table->foreignId('target_id')->nullable()->after('retention_days')->constrained('backup_targets')->nullOnDelete();
            $table->string('mode')->default('full')->after('target_id');
        });
    }

    public function down(): void
    {
        Schema::table('backup_schedules', function (Blueprint $table) {
            $table->dropConstrainedForeignId('target_id');
            $table->dropColumn('mode');
        });
        Schema::table('backups', function (Blueprint $table) {
            $table->dropConstrainedForeignId('target_id');
            $table->dropColumn(['checksum', 'verified_at', 'restore_status', 'snapshot_id']);
        });
        Schema::dropIfExists('backup_targets');
    }
};
