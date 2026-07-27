<?php

use Illuminate\Support\Facades\Route;

/*
| Remaining api.php health probe. Setup/auth bootstrap lives in panel-bootstrap.php
| (loaded via bootstrap/app.php then:) so /api/v1/setup is always registered.
*/

Route::get('/v1/health', fn () => response()->json(['status' => 'ok', 'service' => 'webinoserver-panel']));
