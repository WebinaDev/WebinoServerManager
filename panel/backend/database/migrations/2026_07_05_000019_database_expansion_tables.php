<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hosting_databases')) {
            Schema::table('hosting_databases', function (Blueprint $table) {
                if (! Schema::hasColumn('hosting_databases', 'engine')) {
                    $table->string('engine')->default('mysql')->after('name');
                }
                if (! Schema::hasColumn('hosting_databases', 'size_mb')) {
                    $table->unsignedBigInteger('size_mb')->default(0)->after('status');
                }
            });
        }

        Schema::create('database_users', function (Blueprint $table) {
            $table->id();
            $table->string('username');
            $table->string('host')->default('localhost');
            $table->string('engine')->default('mysql');
            $table->foreignId('database_id')->nullable()->constrained('hosting_databases')->nullOnDelete();
            $table->foreignId('hosting_account_id')->nullable()->constrained('hosting_accounts')->nullOnDelete();
            $table->timestamps();
            $table->unique(['username', 'host', 'engine']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('database_users');

        if (Schema::hasTable('hosting_databases')) {
            Schema::table('hosting_databases', function (Blueprint $table) {
                if (Schema::hasColumn('hosting_databases', 'engine')) {
                    $table->dropColumn('engine');
                }
                if (Schema::hasColumn('hosting_databases', 'size_mb')) {
                    $table->dropColumn('size_mb');
                }
            });
        }
    }
};
