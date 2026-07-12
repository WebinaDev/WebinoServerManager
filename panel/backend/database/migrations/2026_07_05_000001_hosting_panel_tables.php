<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->text('two_factor_secret')->nullable()->after('password');
            $table->timestamp('two_factor_confirmed_at')->nullable()->after('two_factor_secret');
        });

        Schema::create('hosting_domains', function (Blueprint $table) {
            $table->id();
            $table->string('domain')->unique();
            $table->string('slug')->nullable();
            $table->text('aliases')->nullable();
            $table->string('status')->default('pending');
            $table->text('last_error')->nullable();
            $table->timestamps();
        });

        Schema::create('hosting_databases', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('db_user')->nullable();
            $table->text('db_password_encrypted')->nullable();
            $table->string('status')->default('pending');
            $table->text('last_error')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hosting_databases');
        Schema::dropIfExists('hosting_domains');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['two_factor_secret', 'two_factor_confirmed_at']);
        });
    }
};
