"use client";

//  externally installed libraries
import { useState, useEffect} from 'react'
import dynamic from "next/dynamic";

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from "@hookform/resolvers/zod";
import { BarLoader } from 'react-spinners';
import useFetch from '@/hooks/use-fetch';
import { useRouter, useSearchParams } from 'next/navigation';

//  Quill Rich Text Editor css
import 'react-quill-new/dist/quill.snow.css';

//  shadcn components
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

//  Internal defined libraries
import { journalSchema } from '@/app/lib/schema';
import { getMoodById, MOODS } from '@/app/lib/moods';
import { createJournalEntry, getJournalEntry, getDraft, saveDraft, updateJournalEntry } from '@/actions/journal';
import { getPixabayImage } from '@/actions/public'
import { createCollection, getCollections } from '@/actions/collection';
import CollectionForm from '@/components/collection-dialog';
import { Loader2 } from 'lucide-react';

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

const JournalEntryPage = () => {

  const [isCollectionDialogOpen, setIsCollectionDialogOpen] = useState(false);
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const [isEditMode, setIsEditMode] = useState(false);

  const  { 
    loading: entryLoading, 
    fn: fetchEntry, 
    data: existingEntry, 
  } = useFetch(getJournalEntry);

  const  { 
    loading: draftLoading, 
    fn: fetchDraft, 
    data: draftData, 
  } = useFetch(getDraft);

  const {
    loading: savingDraft, 
    fn: saveDraftFn,
    data: savedDraft, 
  } = useFetch(saveDraft);
  
  const  { 
    loading: actionLoading, 
    fn: actionFn, 
    data: actionResult, 
  } = useFetch(isEditMode ?  updateJournalEntry :  createJournalEntry);       

  const  { 
    loading: collectionsLoading, 
    fn: fetchCollectionsFn, 
    data: collections,                      //  returned data from the function
  } = useFetch(getCollections);             //  function name to get the collections from within collections.js

const  { 
    loading: createCollectionsLoading, 
    fn: createCollectionFn,                   //  function name to create a collection from within collections.js
    data: createdCollection,                //  created collection from within the function
  } = useFetch(createCollection);

  const router = useRouter();

  console.log(collections, "collections");

  const { 
    register, handleSubmit, control, formState: {errors, isDirty}, getValues, setValue,  
    reset, watch, 
    } = useForm({
    resolver: zodResolver(journalSchema),
    defaultValues: {
      title: "",
      content: "",
      mood: "",
      collectionId: "",
    }
  });

  useEffect(() => {
    fetchCollectionsFn();

    if(editId){
      setIsEditMode(true);
      fetchEntry();
    } else {
      setIsEditMode(false);
      fetchDraft();
    }
  }, [editId]);

  useEffect(() => {
    if(isEditMode && existingEntry) {
      reset({
        title: existingEntry.title || "",
        content: existingEntry.content || "",
        mood: existingEntry.mood || "",
        collectionId: existingEntry.collectionId || "",
      }); 
    } else if(draftData?.success && draftData?.data)  {
      reset({
        title: draftData.title || "",
        content: draftData.content || "",
        mood: draftData.mood || "",
        collectionId: "",
      });
    } else {
      reset({
        title: "",
        content: "",
        mood: "",
        collectionId: "",
      });
    }
  }, [draftData, isEditMode, existingEntry]);

  useEffect(() => {
    if(actionResult && !actionLoading){

      if(!isEditMode){
        saveDraftFn({ title: "", content: "", mood: "" });
      }

      router.push(`/collection/${actionResult.collectionId ? actionResult.collectionId : "unorganized"}`);
      toast.success(`Entry ${isEditMode ? "updated" : "created"} successfully`);
    }
  },[actionResult, actionLoading]);

  const onSubmit = handleSubmit( async(data) => {
    const mood = getMoodById(data.mood);
    const moodImageUrl = getPixabayImage(mood.moodQuery);

    actionFn({
      ...data,
      moodScore: mood.score,
      moodQuery: mood.pixabayQuery,
      ...(isEditMode && { id: editId }),
    });

  });

  useEffect(() => {
    if(createdCollection){
      setIsCollectionDialogOpen(false);
      fetchCollectionsFn();
      setValue("collectionId", createdCollection.id);
      toast.success(`Collection ${createdCollection.name} created!`);
    }
  },[createdCollection])
  
  const handleCreateCollection = async(data) => {
    createCollectionFn(data)
  }

  const formData = watch();

  const handleSaveDraft = async () => {
    if(!isDirty){
      toast.error("No changes to save");
      return;
    }

    await saveDraftFn(formData);
  }

  useEffect(() => {
    if(savedDraft?.success && !savingDraft){
        toast.success("Draft saved successfully");
      }
  },[savedDraft, savingDraft]);


  const isLoading = actionLoading || collectionsLoading || entryLoading || draftLoading || savingDraft;

  return (
    <div className="py-8">
      <form className="space-y-2 mx-auto" onSubmit={onSubmit}>
        <h1 className="text-5xl md:text-6xl gradient-title">
        {  isEditMode ? "Edit Entry" : "What's on your mind?" }
        </h1>

        { isLoading && <BarLoader color="orange" width={"100%"} /> }

        <div className="space-y-2">
          <label className="text-sm font-medium">Title</label>
          <Input
            disabled={isLoading} 
            { ...register("title")}     // From useForm and journalSchema definition
            placeholder="Give your entry a title"
            className={`py-5 md:text-md ${errors.title} ? "border-red-500" : ""` } />
            {errors.title && (
              <p className="text-red-500 text-sm">{errors.title.message}</p>
            )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">How are you feeling?</label>
          {/* From react-hook-form - Ties the select componenet back to react-hook-form */}
          <Controller
            name="mood"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger className={errors.mood ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select a mood..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(MOODS).map((mood) => (
                    <SelectItem key={mood.id} value={mood.id}>
                      <span className="flex items-center gap-2">
                        {mood.emoji} {mood.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.mood && (
              <p className="text-red-500 text-sm">{errors.mood.message}</p>
            )}  
          
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">
              { getMoodById(getValues("mood"))?.prompt ?? "Write your thoughts..."}
            </label>
            {/* From react-hook-form - Ties the select componenet back to react-hook-form */}
            <Controller
              name="content"
              control={control}         
              render={({field}) => (
                <ReactQuill 
                  readOnly={isLoading}
                  theme="snow"
                  value={field.value}
                  onChange={field.onChange}
                  modules={{
                    toolbar: [
                      [{header:[1,2,3,4,5,false]}],
                      ["bold", "italic", "underline", "strike"],
                      [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
                      ["blockquote", "code-block"],
                      ["link","image"],
                      ["clean"],
                    ]
                  }}
                />
              )}
            />
            {errors.content && (
                <p className="text-red-500 text-sm">{errors.content.message}</p>
            )}  
          
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
              Add to Collection (Optional)
          </label>
          <Controller
            name="collectionId"
            control={control}
            render={({ field }) => (
              <Select
                onValueChange={(value) => {
                  if (value === "new") {
                    setIsCollectionDialogOpen(true);
                  } else {
                    field.onChange(value);
                  }
                }}
                value={field.value}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a collection..." />
                </SelectTrigger>
                <SelectContent>
                  {collections?.map((collection) => (
                    <SelectItem key={collection.id} value={collection.id}>
                      {collection.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="new">
                    <span className="text-orange-600">
                      + Create New Collection
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          
        </div>

        <div className="space-x-4 flex">

          {!isEditMode && (
            <Button 
              onClick={ handleSaveDraft }
              type="button"
              variant="outline"
              disabled={savingDraft || !isDirty}>
                {savingDraft && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save as Draft
              </Button>
          )}

          <Button type="submit" variant="journal" disabled={actionLoading}>
            {isEditMode ? "Update" : "Publish" }
          </Button>

          {isEditMode && (
            <Button 
              onClick={(e) => {
                e.preventDefault();
                router.push(`/journal/${existingEntry.id}`);
              }}
              variant="destructive">
                Cancel
              </Button>
          )}

        </div>

      </form>

      <CollectionForm 
        loading={createCollectionsLoading}
        onSuccess={handleCreateCollection}
        open={isCollectionDialogOpen}
        setOpen={setIsCollectionDialogOpen}
      />
    </div>
  )
}

export default JournalEntryPage