<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('security_risk_checks', function (Blueprint $table) {
            $table->id();
            $table->string('check_id', 64)->unique();
            $table->string('status', 16)->default('unknown'); // pass|fail|ignore|unknown
            $table->boolean('fixable')->default(false);
            $table->string('title')->nullable();
            $table->json('detail')->nullable();
            $table->timestamp('scanned_at')->nullable();
            $table->timestamps();
        });

        Schema::create('security_tamper_watches', function (Blueprint $table) {
            $table->id();
            $table->string('path', 512);
            $table->boolean('enabled')->default(true);
            $table->unsignedInteger('last_diff_count')->default(0);
            $table->timestamp('last_scanned_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('security_tamper_watches');
        Schema::dropIfExists('security_risk_checks');
    }
};
