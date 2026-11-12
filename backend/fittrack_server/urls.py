from django.urls import path

from sync_app import account_views, auth_views, views

urlpatterns = [
    path('api/account/export', account_views.export),
    path('api/account/delete', account_views.delete),
    path('api/auth/session', auth_views.session),
    path('api/auth/register', auth_views.register),
    path('api/auth/login', auth_views.login),
    path('api/auth/logout', auth_views.logout),
    path('api/sync/state', views.state),
    path('api/sync/publish', views.publish),
]
