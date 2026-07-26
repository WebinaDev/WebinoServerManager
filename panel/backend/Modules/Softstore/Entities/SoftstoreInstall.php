<?php

namespace Modules\Softstore\Entities;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Websites\Entities\HostingWebsite;

class SoftstoreInstall extends Model
{
    protected $table = 'softstore_installs';

    protected $fillable = [
        'package_id',
        'status',
        'log',
        'requested_by',
        'website_id',
    ];

    public function package(): BelongsTo
    {
        return $this->belongsTo(SoftstorePackage::class, 'package_id');
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function website(): BelongsTo
    {
        return $this->belongsTo(HostingWebsite::class, 'website_id');
    }
}
