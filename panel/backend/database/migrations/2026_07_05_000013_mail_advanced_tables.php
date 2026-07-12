<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mail_domains', function (Blueprint $table) {
            $table->string('catch_all')->nullable()->after('last_error');
            $table->string('dkim_selector')->nullable()->after('catch_all');
            $table->text('dkim_public_key')->nullable()->after('dkim_selector');
        });

        Schema::create('mail_autoresponders', function (Blueprint $table) {
            $table->id();
            $table->string('address')->unique();
            $table->string('subject')->default('Out of office');
            $table->text('body');
            $table->boolean('enabled')->default(true);
            $table->string('status')->default('pending');
            $table->text('last_error')->nullable();
            $table->timestamps();
        });

        Schema::create('mailing_lists', function (Blueprint $table) {
            $table->id();
            $table->string('source')->unique();
            $table->json('destinations');
            $table->string('status')->default('pending');
            $table->text('last_error')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mailing_lists');
        Schema::dropIfExists('mail_autoresponders');
        Schema::table('mail_domains', function (Blueprint $table) {
            $table->dropColumn(['catch_all', 'dkim_selector', 'dkim_public_key']);
        });
    }
};
