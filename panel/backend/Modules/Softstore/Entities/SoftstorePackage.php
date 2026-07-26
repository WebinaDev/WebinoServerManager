<?php

namespace Modules\Softstore\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SoftstorePackage extends Model
{
    protected $table = 'softstore_packages';

    protected $fillable = [
        'slug',
        'name',
        'category',
        'description',
        'version_label',
        'agent_script_id',
        'pinable',
    ];

    protected $casts = [
        'pinable' => 'boolean',
    ];

    public function installs(): HasMany
    {
        return $this->hasMany(SoftstoreInstall::class, 'package_id');
    }

    public function pins(): HasMany
    {
        return $this->hasMany(SoftstorePin::class, 'package_id');
    }
}
