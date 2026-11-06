from django.urls import path

from sync_app import views

urlpatterns = [
    path('api/sync/state', views.state),
    path('api/sync/publish', views.publish),
]
