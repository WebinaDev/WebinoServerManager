<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('users')) {
            Schema::table('users', function (Blueprint $table) {
                if (Schema::hasColumn('users', 'tenant_id')) {
                    $table->dropConstrainedForeignId('tenant_id');
                }
                if (Schema::hasColumn('users', 'role')) {
                    $table->dropColumn('role');
                }
            });
        }

        Schema::dropIfExists('payment_intents');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('cart_items');
        Schema::dropIfExists('carts');
        Schema::dropIfExists('products');
        Schema::dropIfExists('categories');
        Schema::dropIfExists('cms_pages');
        Schema::dropIfExists('marketing_campaigns');
        Schema::dropIfExists('tenant_modules');
        Schema::dropIfExists('dashboard_modules');
        Schema::dropIfExists('tenants');
    }

    public function down(): void
    {
        if (! Schema::hasTable('tenants')) {
            Schema::create('tenants', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('slug')->unique();
                $table->string('domain')->nullable()->index();
                $table->string('license_key')->nullable();
                $table->boolean('setup_completed')->default(true);
                $table->string('store_display_name')->nullable();
                $table->string('default_currency', 8)->default('IRR');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('dashboard_modules')) {
            Schema::create('dashboard_modules', function (Blueprint $table) {
                $table->string('slug')->primary();
                $table->string('git_repo')->nullable();
                $table->string('default_version')->nullable();
                $table->boolean('requires_license')->default(true);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('tenant_modules')) {
            Schema::create('tenant_modules', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->string('module_slug');
                $table->boolean('enabled')->default(false);
                $table->boolean('licensed')->default(false);
                $table->string('installed_version')->nullable();
                $table->timestamp('synced_at')->nullable();
                $table->timestamps();
                $table->unique(['tenant_id', 'module_slug']);
                $table->foreign('module_slug')->references('slug')->on('dashboard_modules')->cascadeOnDelete();
            });
        }

        if (! Schema::hasTable('categories')) {
            Schema::create('categories', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->string('name');
                $table->string('slug');
                $table->timestamps();
                $table->unique(['tenant_id', 'slug']);
            });
        }

        if (! Schema::hasTable('products')) {
            Schema::create('products', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
                $table->string('name');
                $table->string('sku')->nullable();
                $table->unsignedBigInteger('price_minor')->default(0);
                $table->string('currency', 8)->default('IRR');
                $table->unsignedInteger('stock')->default(0);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('carts')) {
            Schema::create('carts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('cart_items')) {
            Schema::create('cart_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('cart_id')->constrained()->cascadeOnDelete();
                $table->foreignId('product_id')->constrained()->cascadeOnDelete();
                $table->unsignedInteger('quantity')->default(1);
                $table->timestamps();
                $table->unique(['cart_id', 'product_id']);
            });
        }

        if (! Schema::hasTable('orders')) {
            Schema::create('orders', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->string('status')->default('pending_payment');
                $table->unsignedBigInteger('total_minor')->default(0);
                $table->string('currency', 8)->default('IRR');
                $table->string('payment_provider')->nullable();
                $table->string('payment_ref')->nullable();
                $table->text('shipping_address')->nullable();
                $table->string('customer_phone', 32)->nullable();
                $table->string('customer_note', 500)->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('order_items')) {
            Schema::create('order_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('order_id')->constrained()->cascadeOnDelete();
                $table->foreignId('product_id')->constrained()->cascadeOnDelete();
                $table->unsignedInteger('quantity');
                $table->unsignedBigInteger('unit_price_minor');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('payment_intents')) {
            Schema::create('payment_intents', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('order_id')->constrained()->cascadeOnDelete();
                $table->string('provider');
                $table->string('status')->default('created');
                $table->text('redirect_url')->nullable();
                $table->json('meta')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('marketing_campaigns')) {
            Schema::create('marketing_campaigns', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->string('name');
                $table->string('status', 24)->default('draft');
                $table->timestamp('starts_at')->nullable();
                $table->timestamp('ends_at')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('cms_pages')) {
            Schema::create('cms_pages', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->string('slug');
                $table->string('title');
                $table->text('body')->nullable();
                $table->boolean('published')->default(false);
                $table->timestamps();
                $table->unique(['tenant_id', 'slug']);
            });
        }

        if (Schema::hasTable('users')) {
            Schema::table('users', function (Blueprint $table) {
                if (! Schema::hasColumn('users', 'tenant_id')) {
                    $table->foreignId('tenant_id')->nullable()->after('id')->constrained()->nullOnDelete();
                }
                if (! Schema::hasColumn('users', 'role')) {
                    $table->string('role')->default('admin')->after('password');
                }
            });
        }
    }
};
