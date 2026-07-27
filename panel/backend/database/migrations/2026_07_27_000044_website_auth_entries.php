<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hosting_websites', function (Blueprint $table) {
            $table->json('auth_entries')->nullable()->after('deny_paths');
        });
    }

    public function down(): void
    {
        Schema::table('hosting_websites', function (Blueprint $table) {
            $table->dropColumn('auth_entries');
        });
    }
};
